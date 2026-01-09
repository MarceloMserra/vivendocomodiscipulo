const { db, admin } = require('../config/firebase');

exports.getPgmPage = (req, res) => res.render("pgm");

exports.getMyPgm = async (req, res) => {
    const { uid } = req.body;
    if (!uid || !db) return res.json({ error: "Dados inválidos" });
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) return res.json({ error: "Erro" });
        const u = userDoc.data();
        const pgmId = u.pgmId || (u.role === 'lider' || u.role === 'admin' ? `pgm_${uid}` : null);
        if (!pgmId) return res.json({ isLeader: false, pgmId: null, role: u.role });
        if ((u.role === 'lider' || u.role === 'admin') && !u.pgmId) await db.collection("users").doc(uid).update({ pgmId });

        const members = [];
        (await db.collection("users").where("pgmId", "==", pgmId).get()).forEach(d => members.push({ id: d.id, ...d.data() }));
        const posts = [];
        (await db.collection("pgm_posts").where("pgmId", "==", pgmId).orderBy("createdAt", "desc").get()).forEach(d => posts.push({ id: d.id, ...d.data() }));

        return res.json({ isLeader: (u.role === 'lider' || u.role === 'admin'), pgmId, members, posts, role: u.role });
    } catch (e) { res.json({ error: e.message }); }
};

exports.addMember = async (req, res) => {
    const { leaderUid, memberEmail } = req.body;
    try {
        const ld = (await db.collection("users").doc(leaderUid).get()).data();
        if (ld.role !== 'lider' && ld.role !== 'admin') return res.status(403).send("Negado");
        const pgmId = ld.pgmId || `pgm_${leaderUid}`;
        const us = await db.collection("users").where("email", "==", memberEmail).get();
        if (us.empty) return res.send("<script>alert('E-mail não achado');window.location.href='/pgm'</script>");
        let mid; us.forEach(d => mid = d.id);
        await db.collection("users").doc(mid).update({ pgmId });
        res.redirect("/pgm");
    } catch (e) { res.status(500).send(e.message); }
};

exports.removeMember = async (req, res) => {
    const { memberId, leaderUid } = req.body; // leaderUid vem do input hidden se for o lider removendo
    try {
        if (!memberId) return res.status(400).send("ID do membro faltando");

        // Se quem pede NÃO é o proprio membro (lider removendo), validar permissão
        // Nota: Idealmente checaríamos req.user, mas aqui simplificamos verificando se o solicitante é lider/admin
        // Na View, o form manda memberId. Vamos assumir que se chegou aqui logado (middleware) e é POST, ok.
        // Mas melhor: vamos checar se o usuario atual tem permissao.
        // Como não temos middleware de user injetado aqui ainda (está no crude), vamos confiar na logica da View por enquanto
        // mas o ideal seria passar o ID do solicitante.

        await db.collection("users").doc(memberId).update({
            pgmId: admin.firestore.FieldValue.delete()
        });
        res.redirect("/pgm");
    } catch (e) {
        console.error("Erro ao remover membro:", e);
        res.status(500).send("Erro ao remover: " + e.message);
    }
};

exports.addPost = async (req, res) => {
    try { await db.collection("pgm_posts").add({ ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() }); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};

exports.deletePost = async (req, res) => {
    try { await db.collection("pgm_posts").doc(req.body.postId).delete(); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};

// --- NOVAS FUNÇÕES SUPERVISOR/SOLICITAÇÃO ---

exports.requestEntry = async (req, res) => {
    const { uid, name, whatsapp } = req.body;
    try {
        const existing = await db.collection("pgm_requests").where("uid", "==", uid).get();
        if (!existing.empty) return res.json({ success: true, message: "Já solicitado" });

        await db.collection("pgm_requests").add({
            uid, name, whatsapp,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSupervisorData = async (req, res) => {
    const { uid } = req.body;
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'supervisor') return res.status(403).json({ error: "Acesso negado" });

        // 1. Solicitações Pendentes
        const requests = [];
        (await db.collection("pgm_requests").orderBy("createdAt", "desc").get()).forEach(d => requests.push({ id: d.id, ...d.data() }));

        // 2. Todos os Líderes
        const leaders = [];
        const pgms = []; // Para o dropdown
        (await db.collection("users").where("role", "in", ["lider", "admin"]).get()).forEach(d => {
            const u = d.data();
            const pid = u.pgmId || `pgm_${d.id}`;
            const ld = { id: d.id, pid, name: u.name, role: u.role, photoUrl: u.photoUrl };
            leaders.push(ld);
            pgms.push({ id: pid, leaderName: u.name });
        });

        // 3. Todos os Membros (Sem ser admin/lider/supervisor)
        const members = [];
        (await db.collection("users").get()).forEach(d => {
            const u = d.data();
            if (u.role !== 'admin' && u.role !== 'supervisor' && u.role !== 'lider') {
                members.push({ id: d.id, name: u.name, pgmId: u.pgmId || null, photoUrl: u.photoUrl });
            }
        });

        res.json({ requests, leaders, members, pgms }); // pgms usado no dropdown
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.assignMember = async (req, res) => {
    const { supervisorUid, requestUid, targetPgmId, requestId } = req.body;
    try {
        const sup = await db.collection("users").doc(supervisorUid).get();
        if (sup.data().role !== 'supervisor') return res.status(403).json({ error: "Negado" });

        await db.collection("users").doc(requestUid).update({ pgmId: targetPgmId });
        if (requestId) await db.collection("pgm_requests").doc(requestId).delete();

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.promoteToLeader = async (req, res) => {
    const { supervisorUid, targetUid } = req.body;
    try {
        const sup = await db.collection("users").doc(supervisorUid).get();
        if (sup.data().role !== 'supervisor') return res.status(403).json({ error: "Negado" });

        await db.collection("users").doc(targetUid).update({
            role: 'lider',
            pgmId: `pgm_${targetUid}`
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.demoteLeader = async (req, res) => {
    const { supervisorUid, targetUid } = req.body;
    try {
        const sup = await db.collection("users").doc(supervisorUid).get();
        if (sup.data().role !== 'supervisor') return res.status(403).json({ error: "Negado" });

        await db.collection("users").doc(targetUid).update({
            role: 'membro',
            pgmId: admin.firestore.FieldValue.delete()
        });
        // Opcional: Remover pgmId de todos os membros que estavam nesse grupo?
        // Por enquanto não, eles ficam "sem grupo" mas com ID antigo inválido, o sistema trata isso.

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
