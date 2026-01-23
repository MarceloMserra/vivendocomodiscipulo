const admin = require("firebase-admin");
const path = require("path");

let db = null;
let auth = null;
let storage = null;

try {
    const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "vivendo-como-discipulo.firebasestorage.app" // Confirmed via Console
    });
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
    console.log("✅ Firebase conectado!");
} catch (error) {
    console.error("❌ Erro no Firebase:", error.message);
}

module.exports = { admin, db, auth, storage };
