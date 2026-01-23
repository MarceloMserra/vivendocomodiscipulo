const { db, admin } = require('../config/firebase');

async function testQuery() {
    try {
        console.log("Running test query to trigger Index Error...");

        // Simulate the query: Leader viewing their own data
        // We need a dummy UID. It doesn't matter if it exists for the index check.
        const dummyUid = "TEST_UID_123";
        const start = new Date();
        start.setDate(start.getDate() - 90);
        const end = new Date();

        const q = db.collection('meetings')
            .where('leaderUid', '==', dummyUid)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .orderBy('date', 'desc');

        await q.get();
        console.log("Query Successful! (Index might already exist?)");

    } catch (e) {
        console.log("\n--- ERROR CAUGHT ---");
        console.log(e.message);
        console.log("--------------------\n");
    }
}

testQuery();
