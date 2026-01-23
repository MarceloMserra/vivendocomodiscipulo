const { admin, db } = require('./src/config/firebase');

async function checkAuth() {
    console.log("--- Verifying Auth Users vs Firestore Users ---");

    // 1. Get All Firestore Users
    const snaps = await db.collection("users").get();
    const firestoreUsers = [];
    snaps.forEach(doc => firestoreUsers.push({ id: doc.id, ...doc.data() }));

    console.log(`Found ${firestoreUsers.length} users in Firestore.`);

    // 2. Check Auth for specific recent users
    const targets = ["Arthur", "Bruno", "Raphael", "Phelipe", "Marcelo"];

    for (const u of firestoreUsers) {
        if (targets.some(t => u.displayName && u.displayName.includes(t))) {
            try {
                // Try to get by UID (if match) or Email
                let authUser;
                try {
                    authUser = await admin.auth().getUser(u.id); // Assuming we ideally kept UIDs in sync?
                } catch (e) {
                    try {
                        if (u.email) authUser = await admin.auth().getUserByEmail(u.email);
                    } catch (e2) {
                        // Not found
                    }
                }

                if (authUser) {
                    console.log(`✅ [AUTH EXISTS] ${u.displayName} (${u.email}) -> UID: ${authUser.uid}`);
                } else {
                    console.log(`❌ [AUTH MISSING] ${u.displayName} (${u.email}) - Cannot Login`);
                }
            } catch (e) {
                console.log(`Error checking ${u.displayName}:`, e.message);
            }
        }
    }
    process.exit();
}

checkAuth();
