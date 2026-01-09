const admin = require("firebase-admin");
const path = require("path");

let db = null;
let auth = null;

try {
    const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    auth = admin.auth(); // Added auth just in case we need it later
    console.log("✅ Firebase conectado!");
} catch (error) {
    console.error("❌ Erro no Firebase:", error.message);
}

module.exports = { admin, db, auth };
