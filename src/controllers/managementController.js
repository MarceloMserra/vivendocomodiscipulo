const { db, admin } = require('../config/firebase');
const User = require('../models/User');

exports.getManagementPage = (req, res) => res.render("management");

exports.getDashboardStats = async (req, res) => {
    try {
        // V3 Stats: Use 'roles.KEY'
        const totalMembersSnap = await db.collection("users").count().get();
        const stats = {
            total: totalMembersSnap.data().count, // Raw Total
            leaders: (await db.collection("users").where("roles.leader", "==", true).count().get()).data().count,
            supervisors: (await db.collection("users").where("roles.supervisor", "==", true).count().get()).data().count,
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
        if (search) {
            const searchLower = search.toLowerCase();
            query = query.orderBy("name_lower").startAt(searchLower).endAt(searchLower + '\uf8ff');
        } else if ((!roleFilter || roleFilter === 'all') && !groupFilter) {
            query = query.orderBy("displayName"); // Use displayName instead of name
        }

        // --- 2. FILTERS (V3 Role Object) ---
        if (roleFilter && roleFilter !== 'all') {
            // Map Frontend Roles to DB Keys
            let dbRole = roleFilter;
            if (roleFilter === 'lider') dbRole = 'leader';
            if (roleFilter === 'membro') dbRole = 'member';

            query = query.where(`roles.${dbRole}`, "==", true);
        }

        if (groupFilter) {
            // Handle "leaderUid" filtering (V3)
            query = query.where("leaderUid", "==", groupFilter);
        }

        // --- 3. PERMISSION CHECK ---
        let requester = null;
        if (uid) {
            const requesterDoc = await db.collection("users").doc(uid).get();
            if (requesterDoc.exists) requester = new User({ ...requesterDoc.data(), uid });

            // Leader ONLY sees their own group
            if (requester && requester.isLeader()) {
                query = query.where("leaderUid", "==", uid);
            }
        }

        // --- 4. PAGINATION ---
        if (lastId) {
            const lastDoc = await db.collection("users").doc(lastId).get();
            if (lastDoc.exists) query = query.startAfter(lastDoc);
        }

        const snapshot = await query.limit(parseInt(limit)).get();

        // --- 5. DATA RESOLUTION (Refactored for V3 leaderUid) ---
        // Build map for Leader Names (UID -> Name)
        const leaderMap = {};

        // Fetch ALL potential leaders (Admins, Supervisors, Leaders)
        const [admins, sups, leaders] = await Promise.all([
            db.collection("users").where("roles.admin", "==", true).get(),
            db.collection("users").where("roles.supervisor", "==", true).get(),
            db.collection("users").where("roles.leader", "==", true).get()
        ]);

        const registerLeader = (doc) => {
            const d = doc.data();
            const name = d.displayName || d.name || 'Sem Nome';
            leaderMap[doc.id] = name;
        };

        admins.forEach(registerLeader);
        sups.forEach(registerLeader);
        leaders.forEach(registerLeader);

        const users = [];

        snapshot.forEach(doc => {
            const d = doc.data();

            // Extra safety
            if (requester && requester.isLeader() && d.leaderUid !== uid && doc.id !== uid) return;

            // DETERMINE PRIMARY ROLE (V3)
            let primaryRole = 'membro';
            const r = d.roles || {};
            if (r.admin) primaryRole = 'admin';
            else if (r.supervisor) primaryRole = 'supervisor';
            else if (r.leader) primaryRole = 'lider';

            let groupLabel = '-';

            // LOGIC: Who is this person's leader?
            if (d.leaderUid && leaderMap[d.leaderUid]) {
                groupLabel = leaderMap[d.leaderUid];
            } else if (d.leaderUid) {
                groupLabel = 'Líder Desconhecido';
            } else if (primaryRole === 'admin') {
                groupLabel = '� Mestre';
            } else {
                groupLabel = 'Sem Líder';
            }

            // Self-Definition Overrides
            if (primaryRole === 'lider') groupLabel += ' (Líder)';
            if (primaryRole === 'supervisor') groupLabel += ' (Supervisor)';

            users.push({
                uid: doc.id,
                name: d.displayName || d.name || 'Sem Nome',
                role: primaryRole,
                photoUrl: d.photoUrl || d.photoURL || '',
                leaderName: groupLabel, // This now comes from leaderUid
                leaderUid: d.leaderUid, // Pass for frontend logic
                // Metadata for UI logic
                isLeader: (primaryRole === 'lider' || primaryRole === 'supervisor' || primaryRole === 'admin'),
                memberCount: 0 // Simplified for performance
            });
        });

        res.json({ users, lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

exports.updateUser = async (req, res) => {
    const { adminUid, targetUid, updates } = req.body;
    try {
        const ad = await db.collection("users").doc(adminUid).get();
        if (!ad.exists) return res.status(403).json({ error: `Usuário solicitante não encontrado` });

        // Check Permissions (Simplified for V3)
        const adminData = ad.data();
        const isAdmin = adminData.roles && (adminData.roles.admin || adminData.roles.supervisor);

        if (!isAdmin) {
            return res.status(403).json({ error: "Acesso Negado." });
        }

        console.log(`[DEBUG] UpdateUser V3 - Admin: ${adminUid} -> Target: ${targetUid}`, updates);

        // Ensure searched name is updated if name changes
        if (updates.name) {
            updates.name_lower = updates.name.toLowerCase();
            updates.displayName = updates.name; // Sync displayName
        }

        // Logic for Hierarchy Changes (V3)
        if (updates.leaderUid) {
            // Remove legacy field
            updates.pgmId = admin.firestore.FieldValue.delete();
        }

        if (updates.role) {
            // Map simple role string back to V3 roles object
            const r = updates.role;
            const newRoles = {
                member: true, // Everyone is a member
                leader: (r === 'lider'),
                supervisor: (r === 'supervisor'),
                admin: (r === 'admin')
            };
            updates.roles = newRoles;
            delete updates.role; // Don't save string field
        }

        // Use set with merge true
        await db.collection("users").doc(targetUid).set(updates, { merge: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getGroupsList = async (req, res) => {
    try {
        // Return ALL potential leaders for the dropdown
        const groups = [];
        const seen = new Set();

        const addFromQuery = async (field, typeLabel) => {
            const q = await db.collection("users").where(`roles.${field}`, "==", true).get();
            q.forEach(doc => {
                if (seen.has(doc.id)) return;
                seen.add(doc.id);
                const d = doc.data();
                groups.push({
                    uid: doc.id, // Value is UID
                    name: d.displayName || d.name || 'Sem Nome',
                    type: typeLabel
                });
            });
        };

        await addFromQuery('supervisor', 'Supervisor');
        await addFromQuery('leader', 'Líder');
        await addFromQuery('admin', 'Admin');

        // Sort by Name
        groups.sort((a, b) => a.name.localeCompare(b.name));

        res.json(groups);
    } catch (e) { res.status(500).json({ error: e.message }); }
}
