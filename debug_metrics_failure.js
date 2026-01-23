const PGMService = require('./src/services/PGMService');
const { db } = require('./src/config/firebase');

async function debugMetricsFailure() {
    console.log("--- DEBUGGING METRICS FAILURE ---");
    const email = "tito@pgm.com";

    // Find Tito
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return console.log("Tito not found");
    const titoUid = snap.docs[0].id;
    console.log(`Tito UID: ${titoUid}`);

    try {
        console.log("Calling PGMService.getMetrics...");
        const metrics = await PGMService.getMetrics(titoUid);
        console.log("SUCCESS! Metrics returned:");
        console.log(JSON.stringify(metrics, null, 2));
    } catch (e) {
        console.error("❌ CRASHED:", e);
        console.error(e.stack);
    }
    process.exit();
}

debugMetricsFailure();
