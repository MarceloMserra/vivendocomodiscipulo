const { db } = require('../config/firebase');

async function check() {
    console.log("Checking last meeting...");
    const snap = await db.collection('meetings').orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) {
        console.log("No meetings found.");
    } else {
        const doc = snap.docs[0].data();
        console.log("Last meeting ID:", snap.docs[0].id);
        console.log("Has photoUrl?", !!doc.photoUrl);
        if (doc.photoUrl) {
            console.log("Photo Length:", doc.photoUrl.length);
            console.log("Photo Start:", doc.photoUrl.substring(0, 50));
        }
    }
}
check();
