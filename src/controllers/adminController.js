const { db, admin } = require('../config/firebase');

exports.getAdminPage = (req, res) => res.render("admin");

exports.getUsers = async (req, res) => {
    const { uid } = req.body;
    try {
        const ad = await db.collection("users").doc(uid).get();
        if (!ad.exists || ad.data().role !== 'admin') return res.status(403).json({ error: "Negado" });
        const users = []; const gm = {};
        (await db.collection("users").orderBy("name").get()).forEach(d => {
            const u = d.data(); u.uid = d.id; users.push(u);
            if ((u.role === 'lider' || u.role === 'admin') && u.pgmId) gm[u.pgmId] = u.name;
        });
        res.json(users.map(u => ({ ...u, leaderName: (u.role === 'admin' ? 'Pastor' : (u.role === 'lider' ? 'Líder' : (gm[u.pgmId] || 'Sem Grupo'))) })));
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateRole = async (req, res) => {
    const { adminUid, targetUid, newRole } = req.body;
    try {
        const ad = await db.collection("users").doc(adminUid).get();
        if (ad.data().role !== 'admin') return res.status(403).json({ error: "Negado" });

        const up = { role: newRole };

        if (newRole === 'lider') {
            up.pgmId = `pgm_${targetUid}`;
        } else if (newRole !== 'admin') {
            // Se não for Líder nem Admin (ex: Membro ou Supervisor), remove pgmId de liderança
            up.pgmId = admin.firestore.FieldValue.delete();
        }

        await db.collection("users").doc(targetUid).update(up);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
