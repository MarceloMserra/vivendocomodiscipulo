const { db } = require('../config/firebase');

async function verify() {
    try {
        console.log("--- VERIFICATION ---");

        // 1. Count Users
        const usersSnap = await db.collection('users').get();
        console.log(`Total Users: ${usersSnap.size}`);

        // Sample User
        const sampleUser = usersSnap.docs.find(d => d.data().displayName.includes('Gabriel'));
        if (sampleUser) {
            console.log("Sample User (Gabriel):", JSON.stringify(sampleUser.data(), null, 2));
        }

        // 2. Count Meetings
        const meetingsSnap = await db.collection('meetings').get();
        console.log(`Total Meetings: ${meetingsSnap.size}`);

        // Sample Meeting
        if (!meetingsSnap.empty) {
            const m = meetingsSnap.docs[0].data();
            console.log("Sample Meeting:", JSON.stringify({
                date: m.date.toDate(),
                legacyMemberCount: m.legacyMemberCount,
                leaderUid: m.leaderUid
            }, null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

verify();
