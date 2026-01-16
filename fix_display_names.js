const { db } = require('./src/config/firebase');

async function fixDisplayNames() {
    console.log("--- BACKFILLING MISSING DISPLAY NAMES ---");

    const snapshot = await db.collection('users').get();
    console.log(`Scanning ${snapshot.size} users...`);

    let updates = 0;

    for (const doc of snapshot.docs) {
        const u = doc.data();
        if (!u.displayName) {
            // Fallback: Name from email or "Sem Nome"
            let newName = "Sem Nome";
            if (u.email) {
                newName = u.email.split('@')[0]; // "membro1" from "membro1@teste.com"
                // Capitalize
                newName = newName.charAt(0).toUpperCase() + newName.slice(1);
            }

            console.log(`   + Fixing ${doc.id} (${u.email}) -> "${newName}"`);
            await doc.ref.update({ displayName: newName });
            updates++;
        }
    }

    console.log(`\n✅ Updated ${updates} users.`);
}

fixDisplayNames().then(() => process.exit());
