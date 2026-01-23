const { db, admin } = require('../config/firebase');

async function testUsersQuery() {
    try {
        console.log("Running Users (Leaders) query...");

        const q = db.collection('users')
            .where('roles.lider', '==', true)
            .orderBy('name_lower');

        const snap = await q.get();
        console.log(`Users Query Successful! Found ${snap.size} leaders.`);

    } catch (e) {
        console.log("\n--- USERS QUERY ERROR ---");
        console.log(e.message);
        if (e.details) console.log(e.details);
        console.log("-------------------------\n");
    }
}

testUsersQuery();
