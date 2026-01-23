const { db } = require('../config/firebase');

async function countMeetings() {
    try {
        const snap = await db.collection('meetings').get();
        console.log(`Total Meetings in DB: ${snap.size}`);
        if (snap.size > 0) {
            console.log("Sample Meeting:", JSON.stringify(snap.docs[0].data(), null, 2));
        }
    } catch (e) {
        console.error("Error counting meetings:", e);
    }
}
countMeetings();
