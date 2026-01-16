const { db } = require('./src/config/firebase');
const PGMService = require('./src/services/PGMService');
const User = require('./src/models/User');

async function testAutoSync() {
    console.log("--- TESTING AUTO-SYNC FOR NEW MEMBERS ---");

    // 1. Identify a Target Leader (Líder João)
    const leaderSnap = await db.collection('users').where('displayName', '==', 'Líder João').get();
    if (leaderSnap.empty) { console.error("Leader not found"); return; }
    const leader = leaderSnap.docs[0];
    console.log(`Target Leader: ${leader.data().displayName} (${leader.id})`);

    // 2. Create NEW Member logic (Direct DB Insert, simulating a signup or admin creation)
    const newMemberData = {
        displayName: "Novo Membro AutoSync",
        email: `autosync_${Date.now()}@teste.com`,
        roles: { member: true },
        leaderUid: leader.id, // THE KEY LINK
        createdAt: new Date(),
        photoURL: "https://ui-avatars.com/api/?name=Novo+Auto&background=random"
    };

    const newMemberRef = await db.collection('users').add(newMemberData);
    console.log(`\n✅ Created User: ${newMemberData.displayName} (UID: ${newMemberRef.id})`);

    // 3. Verify Tree IMMEDIATELY
    console.log("Fetching Tree...");

    // Fetch Admin UID (Marcelo) to view full tree
    const adminSnap = await db.collection('users').where('roles.admin', '==', true).get();
    const adminUid = adminSnap.docs[0].id;

    const tree = await PGMService.getNetworkTree(adminUid);

    // 4. Search for new member in tree
    let found = false;

    function findNode(node) {
        if (!node) return;
        if (node.name === newMemberData.displayName) found = true;
        if (node.children) node.children.forEach(findNode);
    }

    findNode(tree);

    if (found) {
        console.log("\n🎉 SUCCESS! The new member appeared in the tree automatically.");
    } else {
        console.error("\n❌ FAILURE! The new member did NOT appear.");
    }

    // Cleanup (Optional, but good practice)
    await newMemberRef.delete();
    console.log("(Test user deleted)");
}

testAutoSync().then(() => process.exit());
