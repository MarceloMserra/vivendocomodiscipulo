const { db } = require('./src/config/firebase');

async function debugTitoRole() {
    console.log("--- DEBUGGING TITO ROLE ---");
    const snap = await db.collection("users").where("email", "==", "tito@pgm.com").get();
    if (snap.empty) {
        console.log("Tito not found");
    } else {
        const d = snap.docs[0].data();
        console.log(`User: ${d.displayName}`);
        console.log(`Legacy Role (string): '${d.role}'`);
        console.log(`Roles Object:`, d.roles);
    }
    process.exit();
}

debugTitoRole();
