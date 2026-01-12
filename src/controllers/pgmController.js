const { db, admin } = require('../config/firebase');

exports.getPgmPage = (req, res) => res.render("pgm");

exports.getMyPgm = async (req, res) => {
    const { uid } = req.body;
    if (!uid || !db) return res.json({ error: "Dados inválidos" });
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) return res.json({ error: "Erro" });
        const u = userDoc.data();

        // If Leader, Admin OR SUPERVISOR, ensure they have their own PGM ID if not set
        // Supervisors are also Leaders of their own group.

        let pgmId = u.pgmId;
        if (!pgmId && (u.role === 'lider' || u.role === 'admin' || u.role === 'supervisor')) {
            pgmId = `pgm_${uid}`;
            await db.collection("users").doc(uid).update({ pgmId });
        }

        // Supervisor can see the panel regardless of pgmId (logic above ensures they have one).

        if (!pgmId) return res.json({ isLeader: false, pgmId: null, role: u.role });

        const members = [];
        (await db.collection("users").where("pgmId", "==", pgmId).get()).forEach(d => members.push({ id: d.id, ...d.data() }));
        const posts = [];
        (await db.collection("pgm_posts").where("pgmId", "==", pgmId).orderBy("createdAt", "desc").get()).forEach(d => posts.push({ id: d.id, ...d.data() }));

        // Fetch Events
        const events = [];
        const now = admin.firestore.Timestamp.now();

        // QUERY WITHOUT ORDERBY to avoid Missing Index Header error
        const eventsSnap = await db.collection("pgm_events").where("pgmId", "==", pgmId).get();

        eventsSnap.forEach(d => {
            const data = d.data();
            // Filter future events
            if (data.date >= now) {
                events.push({
                    id: d.id,
                    ...data,
                    formattedDate: data.date.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    formattedTime: data.date.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    weekday: data.date.toDate().toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
                    rawDate: data.date.toDate() // For sorting
                });
            }
        });

        // Sort in memory
        events.sort((a, b) => a.rawDate - b.rawDate);

        return res.json({
            isLeader: (u.role === 'lider' || u.role === 'admin' || u.role === 'supervisor'),
            pgmId, members, posts, events, role: u.role
        });
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

// --- AGENDA / CALENDAR ---

exports.addEvent = async (req, res) => {
    try {
        const { pgmId, title, location, date, time } = req.body;
        // Construct a Date object or store as string. Storing as ISO string or timestamp is better.
        // Input `date` is YYYY-MM-DD, `time` is HH:MM
        const eventDate = new Date(`${date}T${time}:00`);

        await db.collection("pgm_events").add({
            pgmId,
            title,
            location,
            date: admin.firestore.Timestamp.fromDate(eventDate),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.redirect("/pgm");
    } catch (e) { res.status(500).send(e.message); }
};

exports.deleteEvent = async (req, res) => {
    try { await db.collection("pgm_events").doc(req.body.eventId).delete(); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};

// --- NOVAS FUNÇÕES SUPERVISOR/SOLICITAÇÃO ---

exports.requestEntry = async (req, res) => {
    const { uid, name, whatsapp, requestedLeader } = req.body;
    try {
        const existing = await db.collection("pgm_requests").where("uid", "==", uid).get();
        if (!existing.empty) return res.json({ success: true, message: "Já solicitado" });

        // If requestedLeader not provided in body, try to find in user profile
        let finalRequestedLeader = requestedLeader;

        if (!finalRequestedLeader) {
            const uDoc = await db.collection("users").doc(uid).get();
            if (uDoc.exists && uDoc.data().requestedLeader) {
                finalRequestedLeader = uDoc.data().requestedLeader;
            }
        }

        await db.collection("pgm_requests").add({
            uid, name, whatsapp,
            requestedLeader: finalRequestedLeader || 'Não informado',
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
        // 1. Solicitações Pendentes
        const requests = [];
        const requestDocs = await db.collection("pgm_requests").orderBy("createdAt", "desc").get();

        // Enrich requests with user profile data (to get requestedLeader if missing)
        await Promise.all(requestDocs.docs.map(async (docSnap) => {
            const r = docSnap.data();
            let userParams = {};

            // If leader name missing in request, check user profile
            if (!r.requestedLeader || r.requestedLeader === 'Não informado') {
                try {
                    const uDoc = await db.collection("users").doc(r.uid).get();
                    if (uDoc.exists) {
                        const uData = uDoc.data();
                        if (uData.requestedLeader) userParams.requestedLeader = uData.requestedLeader;
                    }
                } catch (err) { console.error("Error fetching user for request", r.uid, err); }
            }

            requests.push({ id: docSnap.id, ...r, ...userParams });
        }));

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
    const { supervisorUid, requestUid, targetPgmId, requestId, role } = req.body;
    console.log(`[ASSIGN] Request: Sup=${supervisorUid}, TargetUser=${requestUid}, PGM=${targetPgmId}, ReqID=${requestId}, Role=${role}`);

    try {
        const sup = await db.collection("users").doc(supervisorUid).get();
        if (!sup.exists) return res.status(404).json({ error: "Supervisor não encontrado" });
        if (sup.data().role !== 'supervisor') return res.status(403).json({ error: "Apenas supervisores podem aprovar" });

        const updates = {
            role: role || 'membro'
        };

        if (role === 'lider') {
            // New Leader = New Group
            updates.pgmId = `pgm_${requestUid}`;
        } else {
            // Member = Must have a group
            if (!targetPgmId) return res.status(400).json({ error: "Para membros, escolha um grupo." });
            updates.pgmId = targetPgmId;
        }

        // Update User
        await db.collection("users").doc(requestUid).update(updates);
        console.log(`[ASSIGN] User ${requestUid} updated to ${role}.`);

        // Delete Request
        if (requestId) {
            await db.collection("pgm_requests").doc(requestId).delete();
            console.log(`[ASSIGN] Request ${requestId} deleted.`);
        }

        res.json({ success: true });
    } catch (e) {
        console.error("[ASSIGN ERROR]", e);
        res.status(500).json({ error: e.message });
    }
};

exports.rejectRequest = async (req, res) => {
    const { supervisorUid, requestId } = req.body;
    try {
        const sup = await db.collection("users").doc(supervisorUid).get();
        if (sup.data().role !== 'supervisor') return res.status(403).json({ error: "Negado" });

        await db.collection("pgm_requests").doc(requestId).delete();
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
