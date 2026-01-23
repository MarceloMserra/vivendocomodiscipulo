const { db } = require('./src/config/firebase');

async function fixUserNames() {
    console.log("--- MIGRATING USER NAMES ---");
    const snap = await db.collection("users").get();
    let updated = 0;

    const updates = [];
    snap.forEach(doc => {
        const d = doc.data();
        if (!d.name && d.displayName) {
            console.log(`Fixing: ${d.displayName} (${doc.id})`);
            updates.push(db.collection("users").doc(doc.id).update({
                name: d.displayName, // Backfill Name
                name_lower: d.displayName.toLowerCase() // Ensure search works
            }));
            updated++;
        }
    });

    await Promise.all(updates);
    console.log(`✅ Fixed ${updated} users.`);
    process.exit();
}

fixUserNames();
