const { db, admin } = require('../config/firebase');

exports.getManagementPage = (req, res) => res.render("management");

exports.getDashboardStats = async (req, res) => {
    try {
        const totalMembersSnap = await db.collection("users").count().get();
        const stats = {
            total: totalMembersSnap.data().count,
            leaders: (await db.collection("users").where("role", "==", "lider").count().get()).data().count,
            supervisors: (await db.collection("users").where("role", "==", "supervisor").count().get()).data().count,
            withoutGroup: 0
        };
        res.json(stats);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getUsersPaginated = async (req, res) => {
    try {
        const { limit = 20, lastId, roleFilter, search, uid, groupFilter } = req.body;
        let query = db.collection("users"); // Base collection

        // --- 1. SEARCH STRATEGY (Case Insensitive) ---
        // Requires 'name_lower' field in Firestore
        if (search) {
            const searchLower = search.toLowerCase();
            query = query.orderBy("name_lower").startAt(searchLower).endAt(searchLower + '\uf8ff');
        } else if (!roleFilter && !groupFilter) {
            // Only order by name if NO filters are active to avoid "Missing Index" errors on Firestore
            // unless composite indexes are created. For now, prioritize showing data.
            query = query.orderBy("name");
        }

        // --- 2. FILTERS ---
        if (roleFilter && roleFilter !== 'all') {
            query = query.where("role", "==", roleFilter);
        }

        if (groupFilter) {
            query = query.where("pgmId", "==", groupFilter);
        }

        // --- 3. PERMISSION CHECK ---
        let requester = null;
        if (uid) {
            const requesterDoc = await db.collection("users").doc(uid).get();
            if (requesterDoc.exists) requester = requesterDoc.data();

            // Leader ONLY sees their own group
            if (requester && requester.role === 'lider' && requester.pgmId) {
                // Force override any other group filter
                query = query.where("pgmId", "==", requester.pgmId);
            }
        }

        // --- 4. PAGINATION ---
        if (lastId) {
            const lastDoc = await db.collection("users").doc(lastId).get();
            if (lastDoc.exists) query = query.startAfter(lastDoc);
        }

        const snapshot = await query.limit(parseInt(limit)).get();

        // --- 5. DATA RESOLUTION ---
        // Build map for Group Names efficiently
        // Create map for Group Names efficiently
        const pgmMap = {};
        // Retrieve all leaders/admins/supervisors to name the groups
        const leadersSnap = await db.collection("users").where("role", "in", ["lider", "admin", "supervisor"]).get();
        leadersSnap.forEach(l => {
            const ld = l.data();
            const pid = ld.pgmId || `pgm_${l.id}`;
            pgmMap[pid] = ld.name;
        });

        // Resolve active group name if filtering
        let activeGroupName = null;
        if (groupFilter) {
            activeGroupName = pgmMap[groupFilter] || 'Grupo Selecionado';
        }

        const users = [];

        // --- PREPARE MEMBER COUNTS FOR LEADERS/SUPERVISORS ---
        const leaderIds = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.role === 'lider' || d.role === 'admin' || d.role === 'supervisor') leaderIds.push(d.pgmId || `pgm_${doc.id}`);
        });

        const memberCounts = {};
        if (leaderIds.length > 0) {
            await Promise.all(leaderIds.map(async (pid) => {
                const countSnap = await db.collection("users").where("pgmId", "==", pid).count().get();
                memberCounts[pid] = countSnap.data().count;
            }));
        }

        snapshot.forEach(doc => {
            const d = doc.data();

            // Extra safety for leader view
            if (requester && requester.role === 'lider' && requester.pgmId && d.pgmId !== requester.pgmId) return;

            let groupName = '-';
            // Logic: If user IS a leader/supervisor, show their Title. 
            if (d.role === 'lider') {
                groupName = '👑 Líder do Grupo';
            } else if (d.role === 'supervisor') {
                groupName = '�️ Supervisor';
            } else if (d.pgmId) {
                groupName = pgmMap[d.pgmId] || d.leaderName || 'Grupo Desconhecido';
            }

            // Determine Member Count for this user row if they are a leader/supervisor
            let countDisplay = 0;
            if (d.role === 'lider' || d.role === 'admin' || d.role === 'supervisor') {
                const pid = d.pgmId || `pgm_${doc.id}`;
                countDisplay = memberCounts[pid] || 0;
            }

            users.push({
                uid: doc.id,
                name: d.name,
                role: d.role,
                pgmId: d.pgmId,
                photoUrl: d.photoUrl || '',
                leaderName: groupName,
                // Metadata for UI logic
                isLeader: (d.role === 'lider' || d.role === 'supervisor' || d.role === 'admin'),
                memberCount: countDisplay
            });
        });

        res.json({ users, lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null, meta: { activeGroupName } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

exports.updateUser = async (req, res) => {
    const { adminUid, targetUid, updates } = req.body;
    try {
        const ad = await db.collection("users").doc(adminUid).get();
        if (!ad.exists) return res.status(403).json({ error: `Usuário solicitante não encontrado (UID: ${adminUid})` });

        const userData = ad.data();
        const role = userData.role;

        console.log(`[DEBUG] UpdateUser Request - AdminUID: ${adminUid}, Role: ${role}, Target: ${targetUid}`);

        if (role !== 'admin' && role !== 'supervisor') {
            return res.status(403).json({ error: `Acesso Negado. Seu cargo no banco é: '${role}'. (UID: ${adminUid})` });
        }

        if (role === 'supervisor') {
            if (updates.role === 'admin' || updates.role === 'supervisor') return res.status(403).json({ error: "Supervisor só gerencia Líder e Membro" });

            const target = await db.collection("users").doc(targetUid).get();
            if (target.exists) {
                const targetData = target.data();
                if (targetData.role === 'admin') return res.status(403).json({ error: "Não pode alterar Admin" });
                if (targetData.role === 'supervisor') return res.status(403).json({ error: "Não pode alterar outro Supervisor" });
            }
        }

        // Ensure searched name is updated if name changes (not yet exposed but good practice)
        if (updates.name) {
            updates.name_lower = updates.name.toLowerCase();
        }

        // Logic for Groups
        if (updates.pgmId) {
            let leaderName = null;
            if (updates.pgmId.startsWith('pgm_')) {
                const leaderId = updates.pgmId.replace('pgm_', '');
                const leaderDoc = await db.collection("users").doc(leaderId).get();
                if (leaderDoc.exists) leaderName = leaderDoc.data().name;
            } else {
                const q = await db.collection("users").where("pgmId", "==", updates.pgmId).limit(1).get();
                if (!q.empty) leaderName = q.docs[0].data().name;
            }
            if (leaderName) updates.leaderName = leaderName;
        }

        if (updates.role === 'lider') {
            updates.pgmId = `pgm_${targetUid}`;
            updates.leaderName = null;
        }

        // Use set with merge true to ensure fields exist
        await db.collection("users").doc(targetUid).set(updates, { merge: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getGroupsList = async (req, res) => {
    try {
        const snapshot = await db.collection("users").where("role", "in", ["lider", "admin", "supervisor"]).get();
        const groups = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            groups.push({ pgmId: d.pgmId || `pgm_${doc.id}`, name: d.name }); // Sending Leader Name as Group Name
        });
        res.json(groups);
    } catch (e) { res.status(500).json({ error: e.message }); }
}
