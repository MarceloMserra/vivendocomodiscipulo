const { db } = require('./src/config/firebase');

async function debugUserFields() {
    console.log("--- INSPECTING USER FIELDS ---");
    const snap = await db.collection("users").where("email", "==", "tito@pgm.com").get();
    if (snap.empty) return console.log("Not found");

    const d = snap.docs[0].data();
    console.log("Raw Data Keys:", Object.keys(d));
    console.log("name:", d.name);
    console.log("displayName:", d.displayName);
    process.exit();
}

debugUserFields();
