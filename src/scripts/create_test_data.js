const { db, admin } = require('../config/firebase');

async function createTestMeeting() {
    try {
        console.log("Creating Test Meeting...");

        // 1. Get a valid user to be the leader (The first user found)
        const userSnap = await db.collection('users').limit(1).get();
        if (userSnap.empty) {
            console.error("No users found to assign meeting to.");
            return;
        }
        const leaderUid = userSnap.docs[0].id;
        const leaderName = userSnap.docs[0].data().displayName || "Test User";

        console.log(`Assigning meeting to Leader: ${leaderName} (${leaderUid})`);

        // 2. Create a meeting for 'Yesterday'
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(19, 30, 0, 0);

        // 3. Create a meeting for 'Last Week'
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 8);
        lastWeek.setHours(19, 30, 0, 0);

        const batch = db.batch();

        const meeting1Ref = db.collection('meetings').doc();
        batch.set(meeting1Ref, {
            leaderUid: leaderUid,
            date: admin.firestore.Timestamp.fromDate(yesterday),
            attendees: [leaderUid], // Leader was present
            visitorCount: 3,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'SYSTEM_TEST'
        });

        const meeting2Ref = db.collection('meetings').doc();
        batch.set(meeting2Ref, {
            leaderUid: leaderUid,
            date: admin.firestore.Timestamp.fromDate(lastWeek),
            attendees: [leaderUid],
            visitorCount: 5, // More visitors last week
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'SYSTEM_TEST'
        });

        await batch.commit();
        console.log("✅ Test meetings created successfully!");

    } catch (e) {
        console.error("Error creating test data:", e);
    }
}

createTestMeeting();
