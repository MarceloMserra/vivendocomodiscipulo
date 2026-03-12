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
        if (!group) return res.status(404).json({ error: 'Você não tem grupo cadastrado.' });

        const usersSnap = await db.collection("users").where("email", "==", memberEmail).get();
        if (usersSnap.empty) return res.status(404).json({ error: 'Nenhum usuário encontrado com este e-mail.' });

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
        if (!pgmId || !title || !date || !time) return res.status(400).json({ error: 'Dados incompletos.' });

        const group = await Group.findById(pgmId);
        if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

        const eventDate = new Date(`${date}T${time}:00`);
        await group.addEvent({ title, location, date: admin.firestore.Timestamp.fromDate(eventDate) });

        res.redirect("/pgm");
    } catch (e) { res.status(500).json({ error: e.message }); }
};
exports.deleteEvent = async (req, res) => {
    try { await db.collection("pgm_events").doc(req.body.eventId).delete(); res.redirect("/pgm"); } catch (e) { res.status(500).send(e.message); }
};

// --- SUPERVISOR & REQUESTS ---

// --- SUPERVISOR & REQUESTS ---

// --- NEW MODULE: MEETING REPORTS ---

exports.getReportPage = async (req, res) => {
    // Expects query param ?pgmId=... (Or verify user leader status)
    const { pgmId, uid } = req.query; // Assuming link passes /pgm/report?pgmId=X&uid=Y

    try {
        const group = await Group.findById(pgmId);
        if (!group) return res.send("Grupo não encontrado");

        // Fetch Members for Checklist
        const members = await group.getMembers();

        // Render
        res.render("meeting_report", {
            layout: 'main', // Or whatever valid layout
            pgmId,
            user: { uid },
            members: members,
            currentDate: new Date().toISOString().slice(0, 16), // datetime-local format
            helpers: {
                initials: (name) => (name || "Membro").split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(),
                roleBadge: (role) => (role === 'lider' || role === 'admin') ? 'Líder' : 'Membro'
            }
        });

    } catch (e) { res.status(500).send(e.message); }
};

const UploadService = require('../services/uploadService'); // Import Service

exports.submitReport = async (req, res) => {
    try {
        const { pgmId, leaderUid, type, date, feedback, attendees, visitors, photoBase64 } = req.body;

        // Validation
        if (!pgmId || !attendees) return res.status(400).json({ error: "Dados incompletos" });

        // Handle Photo Upload (Storage)
        let photoUrl = null;
        if (photoBase64) {
            // Upload to 'meetings' folder in Storage
            photoUrl = await UploadService.uploadImage(photoBase64, 'meetings');
        }

        // Save Meeting
        const meetingData = {
            pgmId,
            leaderUid,
            type,
            date: admin.firestore.Timestamp.fromDate(new Date(date)),
            feedback,
            attendees, // Array of UIDs
            attCount: attendees.length, // Calculated
            visitors: visitors || [],
            visitorCount: visitors ? visitors.length : 0, // Calculated
            photoUrl: photoUrl, // URL from Storage (or null)
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection("meetings").add(meetingData);

        // V3: Update 'lastMeetingDate' on PGM Group for health checks
        await db.collection("pgms").doc(pgmId).update({
            lastMeetingDate: meetingData.date
        });

        res.json({ success: true, id: docRef.id });

    } catch (e) {
        console.error("ERRO CRITICO AO ENVIAR RELATORIO:", e);
        res.status(500).json({ error: e.message });
    }
};

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

exports.getGroupDetails = async (req, res) => {
    const { uid, groupId } = req.body;
    try {
        const supervisor = await User.findById(uid);
        if (!supervisor || (!supervisor.isSupervisor() && !supervisor.isAdmin())) return res.status(403).json({ error: "Negado" });

        const data = await PGMService.getGroupDetailsForSupervisor(uid, groupId);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSupervisorMetrics = async (req, res) => {
    const { uid } = req.body;
    console.log(`[DEBUG] getSupervisorMetrics called with uid: "${uid}"`);
    try {
        const data = await PGMService.getMetrics(uid);
        console.log(`[DEBUG] metrics returned: ${data ? data.length : 'null'} items`);
        res.json(data);
    } catch (e) {
        console.error(`[DEBUG] Error in getMetrics: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
};

// --- VISUAL TREE (V3 Module 1) ---
exports.getNetworkMapPage = (req, res) => res.render("network_map", { layout: false }); // No layout for full screen map

exports.getGalleryPage = async (req, res) => {
    // Expects ?pgmId=... (fetched via frontend JS or localStorage)
    // Actually, gallery page should probably be rendered for the user's group.
    // Let's assume the frontend passes UID or we use the user's group.
    // For simplicity, let's rely on the frontend passing ?pgmId like the report page.
    // OR, we can fetch the user's group if pgmId is missing.

    // For now, let's use the same pattern as Report: Client knows PGM ID.
    // But since the button in PGM page just links to /pgm/gallery, we might need to fetch it here if not passed.

    // Let's fetch using the Session/Auth logic (which we don't have fully middleware'd).
    // WORKAROUND: The Gallery Button in PGM page will be dynamic too (JS) or we fetch the group of the logged-in user if not provided.

    // Actually, the button I added was static: <a href="/pgm/gallery">.
    // So this controller MUST find the user's PGM PGM.

    // BUT wait, I don't have the UID in the GET request unless passed.
    // The previous page (PGM) had the UID in localStorage and logic to show data.
    // If I just open /pgm/gallery, I don't know who the user is on the server side (no cookie session).
    // I NEED to pass params.

    // Fix: I will update the Gallery Button in PGM.handlebars to be dynamic like the Report button? 
    // OR faster: The gallery page itself is a skeleton that fetches data via API?
    // Let's go with Server Side Rendering for simplicity if possible, but without session it is hard.

    // HYBRID APPROACH: Render the skeleton, then client-side fetch the gallery data?
    // User wants "Beautiful Gallery".
    // Let's do: Render Page -> Page checks localStorage -> Page calls API to get Photos -> Renders Gallery.
    // This avoids the "Link Generation" hell.

    res.render("gallery", { layout: 'main' });
};

exports.getGalleryData = async (req, res) => {
    const { pgmId } = req.body; // or query
    if (!pgmId) return res.json({ error: "PGM ID missing" });

    try {
        const snap = await db.collection("meetings")
            .where("pgmId", "==", pgmId)
            // .orderBy("date", "desc") // requires index
            .get();

        const photos = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.photoUrl) {
                photos.push({
                    id: doc.id,
                    url: d.photoUrl, // Base64 or URL
                    date: d.date.toDate(),
                    formattedDate: d.date.toDate().toLocaleDateString('pt-BR'),
                    type: d.type
                });
            }
        });

        // Manual Sort to avoid index error
        photos.sort((a, b) => b.date - a.date);

        res.json({ photos });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

exports.getNetworkTreeAPI = async (req, res) => {
    const { uid } = req.body;
    try {
        const tree = await PGMService.getNetworkTreePGMBased(uid);
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
