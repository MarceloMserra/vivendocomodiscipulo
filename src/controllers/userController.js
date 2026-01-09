const { db } = require('../config/firebase');

exports.updateProfile = async (req, res) => {
    const { uid, name, whatsapp, email } = req.body;
    try {
        const updateData = { name, whatsapp, email };
        if (req.file) updateData.photoUrl = `/uploads/profiles/${req.file.filename}`;
        await db.collection("users").doc(uid).update(updateData);
        res.json({ success: true, photoUrl: updateData.photoUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getUserData = async (req, res) => {
    const { uid } = req.body;
    try {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists) res.json(doc.data()); else res.status(404).json({ error: "User not found" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
