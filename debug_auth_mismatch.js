const { admin, db } = require('./src/config/firebase');

async function debugAuthMismatch() {
    console.log("--- DEBUGGING AUTH/DB MISMATCH ---");
    const email = "tito@pgm.com";

    try {
        // 1. Check Auth (Actual Login)
        let authUser = null;
        try {
            authUser = await admin.auth().getUserByEmail(email);
            console.log(`[AUTH] User found: ${authUser.uid} (email: ${authUser.email})`);
        } catch (e) {
            console.log(`[AUTH] User NOT found in Authentication: ${e.code}`);
        }

        // 2. Check Firestore (Data) by Email
        const fsSnap = await db.collection("users").where("email", "==", email).get();
        console.log(`[FIRESTORE] Documents with email '${email}': ${fsSnap.size}`);

        fsSnap.forEach(doc => {
            console.log(`   - Doc ID: ${doc.id}`);
            console.log(`     Name: ${doc.data().displayName}`);
            console.log(`     Roles:`, doc.data().roles);

            if (authUser && doc.id !== authUser.uid) {
                console.warn(`   ⚠️  MISMATCH DETECTED! Auth UID (${authUser.uid}) != Firestore ID (${doc.id})`);
            } else if (authUser) {
                console.log(`   ✅ MATCH! Auth UID matches Firestore ID.`);
            }
        });

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit();
}

debugAuthMismatch();
