const PGMService = require('./src/services/PGMService');
const { db } = require('./src/config/firebase');

async function verifyAdmin() {
    console.log("--- VERIFYING ADMIN GLOBAL TREE ---");

    // 1. Create/Update an Admin User
    const adminUid = "admin_user_test";
    await db.collection('users').doc(adminUid).set({
        displayName: "Pastor Principal",
        roles: { admin: true },
        photoURL: null
    });
    console.log("✅ Admin User Created");

    // 2. Ensure we have at least 2 Supervisors
    // Carlos is already Supervisor (ur9G...)
    // Let's make another one
    const dummySupUid = "dummy_supervisor_1";
    await db.collection('users').doc(dummySupUid).set({
        displayName: "Supervisor Dummy",
        roles: { supervisor: true },
        photoURL: null
    });
    console.log("✅ Dummy Supervisor Created");

    // 3. Get Tree as Admin
    try {
        const tree = await PGMService.getNetworkTree(adminUid);
        console.log("ADMIN TREE RESULT:");

        // Use depth 1 logging to avoid spam
        const simplified = {
            name: tree.name,
            role: tree.role,
            childCount: tree.children.length,
            childrenNames: tree.children.map(c => c.name)
        };
        console.log(JSON.stringify(simplified, null, 2));

        if (tree.children.length >= 2) {
            console.log("✅ SUCCESS: Admin sees multiple Supervisors!");
        } else {
            console.log("❌ FAILURE: Admin logic not working or data missing.");
        }

    } catch (e) {
        console.error("ERROR:", e);
    }
}

verifyAdmin().then(() => process.exit());
