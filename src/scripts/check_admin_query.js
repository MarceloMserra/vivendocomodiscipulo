const { db, admin } = require('../config/firebase');

async function testAdminQuery() {
    try {
        console.log("Running Admin (View All) query...");

        const start = new Date();
        start.setDate(start.getDate() - 90);
        const end = new Date();

        // Admin Query: No leaderUid filter
        const q = db.collection('meetings')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(start))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(end))
            .orderBy('date', 'desc');

        const snap = await q.get();
        console.log(`Admin Query Successful! Found ${snap.size} docs.`);

    } catch (e) {
        console.log("\n--- ADMIN QUERY ERROR ---");
        console.log(e.message);
        if (e.details) console.log(e.details);
        console.log("-------------------------\n");
    }
}

testAdminQuery();
