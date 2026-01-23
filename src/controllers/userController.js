const { db, admin } = require('../config/firebase'); // Ensure admin is imported if needed, or just db
const UploadService = require('../services/uploadService');

exports.updateProfile = async (req, res) => {
    const { uid, name, whatsapp, email } = req.body;
    try {
        const updateData = { name, whatsapp, email };
        // Legacy local update (if still used)
        if (req.file) updateData.photoUrl = `/uploads/profiles/${req.file.filename}`;

        await db.collection("users").doc(uid).update(updateData);
        res.json({ success: true, photoUrl: updateData.photoUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.uploadPhoto = async (req, res) => {
    try {
        const { uid, photoBase64 } = req.body;
        if (!uid || !photoBase64) return res.status(400).json({ error: "Dados inválidos" });

        const url = await UploadService.uploadImage(photoBase64, 'profiles');

        // Update User Doc
        await db.collection('users').doc(uid).update({
            photoUrl: url,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getUserData = async (req, res) => {
    const { uid } = req.body;
    try {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists) res.json(doc.data()); else res.status(404).json({ error: "User not found" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
