const { storage } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * Uploads a Base64 image to Firebase Storage.
 * @param {string} base64String - The Base64 string (with or without data:image/jpeg;base64 prefix)
 * @param {string} folder - Target folder (e.g., 'reports', 'profiles')
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
exports.uploadImage = async (base64String, folder = 'uploads') => {
    if (!base64String) return null;

    // --- FALLBACK MODE FOR "NO STORAGE ACTIVATED" ---
    // If we can't write to Storage (Spark Plan limit/Region issue),
    // we return the Base64 Data URL to be saved in the string field.

    // Ensure it has the prefix for browser rendering
    if (!base64String.startsWith('data:')) {
        return `data:image/jpeg;base64,${base64String}`;
    }
    return base64String;

    /* 
    // --- STORAGE MODE (TEMPORARILY DISABLED due to Region Billing Requirement) ---
    // Remove header if present
    const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Generate unique filename
    const filename = `${folder}/${Date.now()}_${uuidv4()}.jpg`;
    const bucket = storage.bucket();
    const file = bucket.file(filename);

    await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
        public: true 
    });

    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
    */
};

/**
 * Deletes a file from Storage
 */
exports.deleteImage = async (fileUrl) => {
    if (!fileUrl) return;
    try {
        // Extract path from URL roughly
        // Url: https://storage.googleapis.com/BUCKET/folder/file.jpg
        const bucketName = storage.bucket().name;
        if (fileUrl.includes(bucketName)) {
            const path = fileUrl.split(bucketName + '/')[1];
            if (path) await storage.bucket().file(path).delete();
        }
    } catch (e) {
        console.error("Error deleting image:", e.message);
    }
};
