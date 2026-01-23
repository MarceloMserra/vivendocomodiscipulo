const { db } = require('./src/config/firebase');

async function debugRequests() {
    console.log("--- DEBUGGING PGM REQUESTS ---");
    try {
        const snap = await db.collection("pgm_requests").orderBy("createdAt", "desc").get();
        console.log(`Total Requests Found: ${snap.size}`);

        if (snap.empty) {
            console.log("No requests found at all.");
        } else {
            snap.forEach(doc => {
                const d = doc.data();
                console.log(`[${doc.id}] ${d.name} (Leader Requested: ${d.requestedLeader}) - Status: ${d.status}`);
            });
        }
    } catch (e) {
        console.error("Error fetching requests:", e.message);
    }
    process.exit();
}

debugRequests();
