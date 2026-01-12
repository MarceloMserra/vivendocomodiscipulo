const { db, admin } = require('../config/firebase');

exports.getManagementPage = (req, res) => res.render("management");

exports.getDashboardStats = async (req, res) => {
    try {
        // Para 10k users, count() aggregation query é mais barato e rápido do que baixar tudo
        // Mas Firestore count() requer index se tiver filtros complexos.
        // Vamos fazer counts simples para os Cards.

        const totalMembersSnap = await db.collection("users").count().get();
        const stats = {
            total: totalMembersSnap.data().count,
            leaders: (await db.collection("users").where("role", "==", "lider").count().get()).data().count,
            supervisors: (await db.collection("users").where("role", "==", "supervisor").count().get()).data().count,
            withoutGroup: 0 // Firestore não suporta where("pgmId", "==", null) direto facilmente sem index, vamos estimar ou usar query client-side limitada se precisar exato.
        };

        // Para "Sem Grupo", infelizmente count() com '!=' ou 'null' pode ser chato.
        // Vamos fazer uma query limitada para pegar os recentes ou usar um contador incremental no futuro.
        // Por hora, vamos deixar 0 ou calcular se der.
        // Solução escalável: Incrementar contador em documento 'stats' quando user entra/sai. (Future improvement)

        res.json(stats);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getUsersPaginated = async (req, res) => {
    try {
        const { limit = 20, lastId, roleFilter, search } = req.body;
        let query = db.collection("users").orderBy("name");

        if (search) {
            // Firestore não tem full-text search nativo.
            // Workaround simples: startAt(search) endAt(search + '\uf8ff')
            // Isso funciona para prefixo. "Marcelo" acha "Marcelo...", mas não "João Marcelo".
            query = query.startAt(search).endAt(search + '\uf8ff');
        }

        if (roleFilter && roleFilter !== 'all') {
            query = query.where("role", "==", roleFilter);
        }

        if (lastId) {
            const lastDoc = await db.collection("users").doc(lastId).get();
            if (lastDoc.exists) query = query.startAfter(lastDoc);
        }

        const snapshot = await query.limit(parseInt(limit)).get();
        const users = [];

        // Otimização: Pegar apenas campos necessários para a tabela
        snapshot.forEach(doc => {
            const d = doc.data();
            users.push({
                uid: doc.id,
                name: d.name,
                role: d.role,
                pgmId: d.pgmId,
                photoUrl: d.photoUrl,
                leaderName: d.leaderName // Assumindo que leaderName já está populado/denormalizado, se não estiver, teríamos que buscar.
                // Idealmente em escala, denormalizamos o nome do líder no user.
            });
        });

        res.json({ users, lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateUser = async (req, res) => {
    const { adminUid, targetUid, updates } = req.body;
    try {
        const ad = await db.collection("users").doc(adminUid).get();
        // Supervisor também pode, checar role
        const role = ad.data().role;
        if (role !== 'admin' && role !== 'supervisor') return res.status(403).json({ error: "Negado" });

        // Se supervisor tentando promover para admin ou supervisor -> bloquear
        if (role === 'supervisor') {
            if (updates.role === 'admin' || updates.role === 'supervisor') return res.status(403).json({ error: "Supervisor só gerencia Líder e Membro" });
        }

        // Lógica de limpar pgmId se virar Lider (cria seu proprio pgmId) ou se perder cargo
        if (updates.role === 'lider') {
            updates.pgmId = `pgm_${targetUid}`; // Cria grupo próprio
        } else if (updates.role && updates.role !== 'lider' && updates.pgmId && updates.pgmId.startsWith('pgm_' + targetUid)) {
            // Se deixou de ser líder, remove o grupo dele (pgmId self) ?
            // updates.pgmId = admin.firestore.FieldValue.delete(); // Cuidado, verificar se é o update de PGM ou de Role.
        }

        await db.collection("users").doc(targetUid).update(updates);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Buscar lista de grupos para o dropdown (apenas nome e ID)
exports.getGroupsList = async (req, res) => {
    try {
        const snapshot = await db.collection("users").where("role", "in", ["lider", "admin"]).get();
        const groups = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            groups.push({ pgmId: d.pgmId || `pgm_${doc.id}`, name: d.name });
        });
        res.json(groups);
    } catch (e) { res.status(500).json({ error: e.message }); }
}
