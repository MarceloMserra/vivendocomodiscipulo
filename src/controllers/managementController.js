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
        const { limit = 50, roleFilter, search, uid, groupFilter } = req.body;
        // Fetch ALL users for in-memory processing (much easier for complex sorting/filtering without composite indexes)
        // Optimization: For < 2000 users, this is fine. For larger, we need better Firestore indexes.

        let query = db.collection("users");
        const snapshot = await query.get();

        // 1. DATA PREPARATION & MAPPING
        const leaderMap = {};
        const allUsers = [];

        // First pass: Build Leader Map & Parse Users
        snapshot.forEach(doc => {
            const d = doc.data();
            const u = {
                uid: doc.id,
                name: d.displayName || d.name || 'Sem Nome',
                name_lower: (d.displayName || d.name || '').toLowerCase(),
                photoUrl: d.photoUrl || d.photoURL || '',
                leaderUid: d.leaderUid,
                roles: d.roles || {},
                createdAt: d.createdAt
            };

            // Determine Primary Role
            if (u.roles.admin) u.primaryRole = 'admin';
            else if (u.roles.supervisor) u.primaryRole = 'supervisor';
            else if (u.roles.leader) u.primaryRole = 'lider';
            else u.primaryRole = 'membro'; // Default

            // Register in Leader Map if applicable
            if (u.primaryRole !== 'membro') {
                leaderMap[u.uid] = u.name;
            }

            allUsers.push(u);
        });

        // 2. FILTERING
        let filtered = allUsers;

        // Search
        if (search) {
            const term = search.toLowerCase();
            filtered = filtered.filter(u => u.name_lower.includes(term));
        }

        // Role Filter (STRICT)
        if (roleFilter && roleFilter !== 'all') {
            if (roleFilter === 'membro') {
                // strict member: ONLY member, not leader/sup/admin
                filtered = filtered.filter(u => u.primaryRole === 'membro');
            } else {
                filtered = filtered.filter(u => u.primaryRole === roleFilter);
            }
        }

        // Group Filter (Leader UID)
        if (groupFilter) {
            filtered = filtered.filter(u => u.leaderUid === groupFilter);
        }

        // Permission Check (Leader sees only own group)
        if (uid) {
            const requester = allUsers.find(u => u.uid === uid);
            if (requester && requester.primaryRole === 'lider') {
                filtered = filtered.filter(u => u.leaderUid === uid || u.uid === uid);
            }
        }

        // 3. ENRICHMENT (Leader Names)
        const finalUsers = filtered.map(u => {
            let groupLabel = '-';
            if (u.leaderUid && leaderMap[u.leaderUid]) {
                groupLabel = leaderMap[u.leaderUid];
            } else if (u.primaryRole !== 'membro') {
                // Self-reference or Hierarchy label
                groupLabel = u.primaryRole === 'lider' ? 'Líder' : (u.primaryRole === 'admin' ? 'Admin' : 'Supervisor');
            } else {
                groupLabel = 'Sem Líder';
            }

            return {
                uid: u.uid,
                name: u.name,
                role: u.primaryRole,
                photoUrl: u.photoUrl,
                leaderName: groupLabel,
                leaderUid: u.leaderUid,
                isLeader: (u.primaryRole !== 'membro')
            };
        });

        // 4. SORTING (Alphabetical)
        finalUsers.sort((a, b) => a.name.localeCompare(b.name));

        // 5. PAGINATION (Total for now)
        res.json({ users: finalUsers, lastId: null });

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
