const PGMService = require('../services/PGMService');
const User = require('../models/User');
const Group = require('../models/Group');
const { db, admin } = require('../config/firebase'); // Mantido para métodos menores ainda não migrados para Service

// Renderiza a página
exports.getPgmPage = (req, res) => res.render("pgm");

/**
 * Endpoint principal do Painel PGM (Dashboard)
 * Retorna dados do Usuário, Grupo e Supervisão
 */
exports.getMyPgm = async (req, res) => {
    const { uid } = req.body; // TODO: Em breve virá de req.user.uid (Auth Middleware)

    if (!uid) return res.json({ error: "UID inválido" });

    try {
        const dashboardData = await PGMService.getDashboardData(uid);

        // Formatar dados para o frontend (Legacy adapter)
        // O front espera { isLeader, pgmId, members, posts, events, role, supervisedGroups }

        const response = {
            role: dashboardData.user.roles, // Pode ser objeto ou string dependendo do legacy
            isLeader: dashboardData.user.isLeader() || dashboardData.user.isAdmin() || dashboardData.user.isSupervisor(),
            pgmId: dashboardData.myGroup ? dashboardData.myGroup.id : null,
            members: dashboardData.myGroup ? dashboardData.myGroup.members : [],
            posts: [], // TODO: Mover para PGMService.getPosts
            events: [], // TODO: Mover para PGMService.getEvents
            supervisedGroups: dashboardData.supervisedGroups
        };

        // Adaptação rápida de Role para string (Legacy Frontend compatibility)
        let legacyRole = 'membro';
        if (dashboardData.user.isSupervisor()) legacyRole = 'supervisor';
        else if (dashboardData.user.isLeader()) legacyRole = 'lider';
        else if (dashboardData.user.isAdmin()) legacyRole = 'admin';
        response.role = legacyRole;

        // Fetch Events & Posts (Legacy Logic preserved temporarily)
        if (response.pgmId) {
            const eventsSnap = await db.collection("pgm_events").where("pgmId", "==", response.pgmId).get();
            const now = admin.firestore.Timestamp.now();
            eventsSnap.forEach(d => {
                const data = d.data();
                if (data.date >= now) {
                    response.events.push({
                        id: d.id,
                        ...data,
                        formattedDate: data.date.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        formattedTime: data.date.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        weekday: data.date.toDate().toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
                        rawDate: data.date.toDate()
                    });
                }
            });
            response.events.sort((a, b) => a.rawDate - b.rawDate);

            const postsSnap = await db.collection("pgm_posts").where("pgmId", "==", response.pgmId).orderBy("createdAt", "desc").get();
            postsSnap.forEach(d => response.posts.push({ id: d.id, ...d.data() }));
        }

        return res.json(response);

    } catch (e) {
        console.error("[PGM Controller] Error:", e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Adiciona membro via E-mail
 */
exports.addMember = async (req, res) => {
    const { leaderUid, memberEmail } = req.body;
    try {
        const leader = await User.findById(leaderUid);
        if (!leader || (!leader.isLeader() && !leader.isAdmin())) return res.status(403).send("Negado");

        const group = await Group.findByLeader(leaderUid);
        if (!group) return res.send("<script>alert('Você não tem grupo!');window.location.href='/pgm'</script>");

        const usersSnap = await db.collection("users").where("email", "==", memberEmail).get();
        if (usersSnap.empty) return res.send("<script>alert('E-mail não achado');window.location.href='/pgm'</script>");

        const memberUid = usersSnap.docs[0].id;
        await User.update(memberUid, { pgmId: group.id, groupId: group.id }); // Dual update for compatibility

        res.redirect("/pgm");
    } catch (e) { res.status(500).send(e.message); }
};

/**
 * Remove membro
 */
exports.removeMember = async (req, res) => {
    const { memberId } = req.body;
    try {
        await User.update(memberId, { pgmId: admin.firestore.FieldValue.delete(), groupId: admin.firestore.FieldValue.delete() });
        res.redirect("/pgm");
    } catch (e) {
        res.status(500).send("Erro ao remover: " + e.message);
    }
};

// --- EVENTS & POSTS (Simple pass-through) ---
exports.addPost = async (req, res) => {
    try { await db.collection("pgm_posts").add({ ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() }); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};
exports.deletePost = async (req, res) => {
    try { await db.collection("pgm_posts").doc(req.body.postId).delete(); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};
exports.addEvent = async (req, res) => {
    try {
        const { pgmId, title, location, date, time } = req.body;
        const group = await Group.findById(pgmId); // ensure group exists

        const eventDate = new Date(`${date}T${time}:00`);
        await group.addEvent({ title, location, date: admin.firestore.Timestamp.fromDate(eventDate) });

        res.redirect("/pgm");
    } catch (e) { res.status(500).send(e.message); }
};
exports.deleteEvent = async (req, res) => {
    try { await db.collection("pgm_events").doc(req.body.eventId).delete(); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};

// --- SUPERVISOR & REQUESTS ---

exports.requestEntry = async (req, res) => {
    const { uid, name, whatsapp, requestedLeader } = req.body;
    try {
        await db.collection("pgm_requests").add({
            uid, name, whatsapp,
            requestedLeader: requestedLeader || 'Não informado',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSupervisorData = async (req, res) => {
    const { uid } = req.body;
    try {
        const data = await PGMService.getSupervisorOverview(uid);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSupervisorMetrics = async (req, res) => {
    const { uid } = req.body;
    try {
        const data = await PGMService.getMetrics(uid);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- VISUAL TREE (V3 Module 1) ---
exports.getNetworkMapPage = (req, res) => res.render("network_map", { layout: false }); // No layout for full screen map

exports.getNetworkTreeAPI = async (req, res) => {
    const { uid } = req.body;
    try {
        const tree = await PGMService.getNetworkTree(uid);
        res.json(tree);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.assignMember = async (req, res) => {
    const { supervisorUid, requestUid, targetPgmId, requestId, role } = req.body;
    try {
        const supervisor = await User.findById(supervisorUid);
        if (!supervisor.isSupervisor()) return res.status(403).json({ error: "Apenas supervisores" });

        const updates = { role: role || 'membro' };
        if (role === 'lider') {
            updates.pgmId = `pgm_${requestUid}`;
            updates.groupId = `pgm_${requestUid}`;
            // TODO: Create Group Model instance here if needed
        } else {
            if (!targetPgmId) return res.status(400).json({ error: "Escolha um grupo" });
            updates.pgmId = targetPgmId;
            updates.groupId = targetPgmId;
        }

        await User.update(requestUid, updates);

        if (requestId) {
            await db.collection("pgm_requests").doc(requestId).delete();
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.rejectRequest = async (req, res) => {
    const { supervisorUid, requestId } = req.body;
    try {
        const supervisor = await User.findById(supervisorUid);
        if (!supervisor.isSupervisor()) return res.status(403).json({ error: "Negado" });
        await db.collection("pgm_requests").doc(requestId).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.promoteToLeader = async (req, res) => {
    const { supervisorUid, targetUid } = req.body;
    try {
        const supervisor = await User.findById(supervisorUid);
        if (!supervisor.isSupervisor()) return res.status(403).json({ error: "Negado" });

        await User.update(targetUid, {
            role: 'lider',
            pgmId: `pgm_${targetUid}`,
            groupId: `pgm_${targetUid}`
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.demoteLeader = async (req, res) => {
    const { supervisorUid, targetUid } = req.body;
    try {
        const supervisor = await User.findById(supervisorUid);
        if (!supervisor.isSupervisor()) return res.status(403).json({ error: "Negado" });

        await User.update(targetUid, {
            role: 'membro',
            pgmId: admin.firestore.FieldValue.delete(),
            groupId: admin.firestore.FieldValue.delete()
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
