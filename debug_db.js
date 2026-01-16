const { db } = require('./src/config/firebase');

async function listUsers() {
    console.log("--- DEBUG USER RELATIONSHIPS ---");
    const snap = await db.collection('users').get();

    if (snap.empty) {
        console.log("No users found.");
        return;
    }

    snap.forEach(doc => {
        const u = doc.data();
        console.log(`User: ${u.displayName} (${doc.id})`);
        console.log(`   Roles: ${JSON.stringify(u.roles)}`);
        console.log(`   LeaderUid: ${u.leaderUid}`);
        console.log(`   PGM ID: ${u.pgmId}`);
        console.log("------------------------------------------------");
    });
}

listUsers().then(() => process.exit());
