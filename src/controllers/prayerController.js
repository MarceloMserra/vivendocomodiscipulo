const { db, admin } = require('../config/firebase');
const User = require('../models/User');

exports.getPrayersPage = (req, res) => {
    res.render('prayers', { layout: 'dashboard' });
};

exports.listPrayers = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = new User({ ...userDoc.data(), uid });

        // Get prayers from user's group or all (admin/supervisor)
        let snap;
        if (userData.isAdmin() || userData.isSupervisor()) {
            snap = await db.collection('prayer_requests')
                .where('status', '!=', 'deleted')
                .orderBy('status')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
        } else {
            const pgmId = userData.pgmId || userData.groupId;
            if (!pgmId) {
                // Show only own requests
                snap = await db.collection('prayer_requests')
                    .where('uid', '==', uid)
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();
            } else {
                snap = await db.collection('prayer_requests')
                    .where('pgmId', '==', pgmId)
                    .where('status', '!=', 'deleted')
                    .orderBy('status')
                    .orderBy('createdAt', 'desc')
                    .limit(30)
                    .get();
            }
        }

        const prayers = [];
        snap.forEach(doc => {
            const p = doc.data();
            prayers.push({
                id: doc.id,
                name: p.anonymous ? 'Anônimo' : (p.name || 'Membro'),
                photoUrl: p.anonymous ? '' : (p.photoUrl || ''),
                request: p.request,
                status: p.status,
                prayCount: p.prayCount || 0,
                hasPrayed: Array.isArray(p.prayedBy) && p.prayedBy.includes(uid),
                isOwner: p.uid === uid,
                isLeader: userData.isLeader() || userData.isAdmin() || userData.isSupervisor(),
                createdAt: p.createdAt ? p.createdAt.toDate().toLocaleDateString('pt-BR') : ''
            });
        });

        res.json({ success: true, prayers });
    } catch (e) {
        console.error('List prayers error:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.addPrayer = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const { request, anonymous } = req.body;

        if (!request || request.trim().length < 5) {
            return res.status(400).json({ error: 'Pedido muito curto.' });
        }
        if (request.length > 500) {
            return res.status(400).json({ error: 'Pedido muito longo (máx 500 caracteres).' });
        }

        const userDoc = await db.collection('users').doc(uid).get();
        const d = userDoc.data();
        const pgmId = d.pgmId || d.groupId || null;

        await db.collection('prayer_requests').add({
            uid,
            pgmId,
            name: d.displayName || d.name || 'Membro',
            photoUrl: (d.photoUrl && !d.photoUrl.startsWith('data:')) ? d.photoUrl : '',
            request: request.trim(),
            anonymous: anonymous === true || anonymous === 'true',
            status: 'active',
            prayCount: 0,
            prayedBy: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Pedido enviado! Sua comunidade irá orar por você.' });
    } catch (e) {
        console.error('Add prayer error:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.prayForRequest = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const { prayerId } = req.body;
        if (!prayerId) return res.status(400).json({ error: 'ID inválido.' });

        const doc = await db.collection('prayer_requests').doc(prayerId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const p = doc.data();
        const hasPrayed = Array.isArray(p.prayedBy) && p.prayedBy.includes(uid);

        if (hasPrayed) {
            await db.collection('prayer_requests').doc(prayerId).update({
                prayedBy: admin.firestore.FieldValue.arrayRemove(uid),
                prayCount: Math.max(0, (p.prayCount || 1) - 1)
            });
            res.json({ success: true, prayCount: Math.max(0, (p.prayCount || 1) - 1), hasPrayed: false });
        } else {
            await db.collection('prayer_requests').doc(prayerId).update({
                prayedBy: admin.firestore.FieldValue.arrayUnion(uid),
                prayCount: (p.prayCount || 0) + 1
            });
            res.json({ success: true, prayCount: (p.prayCount || 0) + 1, hasPrayed: true });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.markAnswered = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const { prayerId } = req.body;

        const doc = await db.collection('prayer_requests').doc(prayerId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const p = doc.data();
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = new User({ ...userDoc.data(), uid });

        if (p.uid !== uid && !userData.isLeader() && !userData.isAdmin() && !userData.isSupervisor()) {
            return res.status(403).json({ error: 'Sem permissão.' });
        }

        await db.collection('prayer_requests').doc(prayerId).update({ status: 'answered' });
        res.json({ success: true, message: 'Oração respondida! Que alegria!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deletePrayer = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const { prayerId } = req.body;

        const doc = await db.collection('prayer_requests').doc(prayerId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const p = doc.data();
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = new User({ ...userDoc.data(), uid });

        if (p.uid !== uid && !userData.isAdmin() && !userData.isSupervisor()) {
            return res.status(403).json({ error: 'Sem permissão.' });
        }

        await db.collection('prayer_requests').doc(prayerId).update({ status: 'deleted' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
