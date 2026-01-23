const { db } = require('../config/firebase');

async function debugMigration() {
    try {
        console.log("--- DEBUG MIGRATION ---");

        // 1. Fetch all users
        const usersSnap = await db.collection('users').get();
        const userIds = new Set();
        usersSnap.forEach(doc => userIds.add(doc.id));
        console.log(`Total Users in DB: ${userIds.size}`);

        // 2. Fetch one meeting
        const meetingsSnap = await db.collection('meetings').limit(5).get();

        meetingsSnap.forEach(doc => {
            const m = doc.data();
            console.log(`\nMeeting ID: ${doc.id}`);
            console.log(`leaderUid: ${m.leaderUid}`);
            console.log(`Exists in Users? ${userIds.has(m.leaderUid)}`);

            if (userIds.has(m.leaderUid)) {
                // Check if this user has pgmId
                const userDoc = usersSnap.docs.find(d => d.id === m.leaderUid);
                console.log(`User Name: ${userDoc.data().displayName}`);
                console.log(`User PGM ID: ${userDoc.data().pgmId}`);
            }
        });

    } catch (e) {
        console.error(e);
    }
}

debugMigration();
