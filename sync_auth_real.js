const { admin, db } = require('./src/config/firebase');

async function syncAuth() {
    console.log("--- SYNCING FIRESTORE USERS TO AUTH ---");

    // 1. Get All Users
    const snaps = await db.collection("users").get();

    // 2. Iterate and Create Auth
    for (const doc of snaps.docs) {
        const u = doc.data();
        const uid = doc.id;

        // Filter mainly for the "Teste" users created recently, or ensure all have auth
        // We'll try to create for ANY user that has an email.
        if (!u.email) continue;

        try {
            // Check if exists
            try {
                await admin.auth().getUser(uid);
                process.stdout.write("."); // Exists
            } catch (e) {
                if (e.code === 'auth/user-not-found') {
                    // Create!
                    console.log(`\ncreating Auth for: ${u.displayName} (${u.email}) [UID: ${uid}]`);

                    await admin.auth().createUser({
                        uid: uid,
                        email: u.email,
                        emailVerified: true,
                        password: "mudar123", // Temporary Password
                        displayName: u.displayName || u.name,
                        photoURL: u.photoUrl || u.photoURL
                    });
                    console.log("   ✅ Created (Pwd: mudar123)");
                } else {
                    throw e;
                }
            }
        } catch (err) {
            console.error(`\n❌ Error processing ${u.email}: ${err.message}`);
        }
    }
    console.log("\nSync Complete.");
    process.exit();
}

syncAuth();
