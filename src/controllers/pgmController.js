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
    try { await db.collection("users").doc(req.body.memberId).update({ pgmId: admin.firestore.FieldValue.delete() }); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
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

        const requests = [];
        (await db.collection("pgm_requests").orderBy("createdAt", "desc").get()).forEach(d => requests.push({ id: d.id, ...d.data() }));

        const pgms = [];
        (await db.collection("users").where("role", "in", ["lider", "admin"]).get()).forEach(d => {
            const u = d.data();
            const pid = u.pgmId || `pgm_${d.id}`;
            pgms.push({ id: pid, leaderName: u.name });
        });

        res.json({ requests, pgms });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.assignMember = async (req, res) => {
    const { supervisorUid, requestUid, targetPgmId, requestId } = req.body;
    try {
        const sup = await db.collection("users").doc(supervisorUid).get();
        if (sup.data().role !== 'supervisor') return res.status(403).json({ error: "Negado" });

        await db.collection("users").doc(requestUid).update({ pgmId: targetPgmId });
        await db.collection("pgm_requests").doc(requestId).delete();

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
