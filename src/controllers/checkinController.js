const { db, admin } = require('../config/firebase');
const User = require('../models/User');
const QRCode = require('qrcode');

const BASE_URL = process.env.BASE_URL || 'https://app.mmdigitall.com.br';

exports.getCheckinPage = (req, res) => {
    res.render('checkin', { layout: 'dashboard' });
};

exports.getCheckinScanPage = (req, res) => {
    res.render('checkin_scan', { layout: 'main', token: req.query.token || '' });
};

exports.startSession = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = new User({ ...userDoc.data(), uid });

        if (!userData.isLeader() && !userData.isSupervisor() && !userData.isAdmin()) {
            return res.status(403).json({ error: 'Apenas líderes podem gerar QR.' });
        }

        const { date, pgmId } = req.body;
        if (!date) return res.status(400).json({ error: 'Data é obrigatória.' });

        // Create session in Firestore
        const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours
        const sessionRef = await db.collection('checkin_sessions').add({
            leaderUid: uid,
            leaderName: userData.displayName,
            pgmId: pgmId || userData.pgmId || null,
            date: admin.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00')),
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            confirmedUids: [],
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const url = `${BASE_URL}/checkin/scan?token=${sessionRef.id}`;
        const qrDataUrl = await QRCode.toDataURL(url, {
            width: 300,
            margin: 2,
            color: { dark: '#0F265C', light: '#FFFFFF' }
        });

        res.json({ success: true, sessionId: sessionRef.id, qrDataUrl, url });
    } catch (e) {
        console.error('Checkin start error:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.confirmPresence = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token inválido.' });

        const sessionDoc = await db.collection('checkin_sessions').doc(token).get();
        if (!sessionDoc.exists) return res.status(404).json({ error: 'Sessão não encontrada.' });

        const session = sessionDoc.data();
        if (session.status !== 'active') return res.status(400).json({ error: 'Esta sessão já foi encerrada.' });

        const now = new Date();
        if (session.expiresAt.toDate() < now) return res.status(400).json({ error: 'QR Code expirado.' });

        if (session.confirmedUids.includes(uid)) {
            return res.json({ success: true, message: 'Presença já confirmada!', alreadyConfirmed: true });
        }

        await db.collection('checkin_sessions').doc(token).update({
            confirmedUids: admin.firestore.FieldValue.arrayUnion(uid)
        });

        res.json({ success: true, message: 'Presença confirmada com sucesso!' });
    } catch (e) {
        console.error('Checkin confirm error:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.closeSession = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const uid = req.user.uid;
        const { sessionId, visitorCount } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId é obrigatório.' });

        const sessionDoc = await db.collection('checkin_sessions').doc(sessionId).get();
        if (!sessionDoc.exists) return res.status(404).json({ error: 'Sessão não encontrada.' });

        const session = sessionDoc.data();
        if (session.leaderUid !== uid) {
            const userDoc = await db.collection('users').doc(uid).get();
            const userData = new User({ ...userDoc.data(), uid });
            if (!userData.isAdmin() && !userData.isSupervisor()) {
                return res.status(403).json({ error: 'Apenas o líder pode encerrar a sessão.' });
            }
        }

        // Save as a meeting record
        await db.collection('meetings').add({
            leaderUid: session.leaderUid,
            pgmId: session.pgmId,
            date: session.date,
            attendees: session.confirmedUids,
            visitorCount: parseInt(visitorCount || 0),
            source: 'qr_checkin',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: uid
        });

        await db.collection('checkin_sessions').doc(sessionId).update({ status: 'closed' });

        res.json({ success: true, message: `Reunião salva com ${session.confirmedUids.length} participante(s).` });
    } catch (e) {
        console.error('Checkin close error:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getSessionStatus = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        const { sessionId } = req.body;
        const sessionDoc = await db.collection('checkin_sessions').doc(sessionId).get();
        if (!sessionDoc.exists) return res.status(404).json({ error: 'Sessão não encontrada.' });

        const session = sessionDoc.data();
        // Get names of confirmed users
        const confirmedNames = [];
        for (const memberUid of session.confirmedUids.slice(0, 50)) {
            const uDoc = await db.collection('users').doc(memberUid).get();
            if (uDoc.exists) {
                const d = uDoc.data();
                confirmedNames.push(d.displayName || d.name || 'Membro');
            }
        }

        res.json({
            success: true,
            count: session.confirmedUids.length,
            status: session.status,
            leaderName: session.leaderName || '',
            confirmedNames
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
