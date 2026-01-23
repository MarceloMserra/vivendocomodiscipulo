const { db } = require('../config/firebase');

async function fixRoles() {
    console.log("--- FIXING ROLES MIGRATION ---");
    const snap = await db.collection('users').get();
    let batch = db.batch();
    let count = 0;
    let updated = 0;

    snap.forEach(doc => {
        const d = doc.data();
        const roles = d.roles || {};

        // Check for 'lider' (legacy/Portuguese) vs 'leader' (English/App Standard)
        if (roles.lider === true && !roles.leader) {
            console.log(`Fixing ${d.displayName}: lider -> leader`);

            // Update role object
            const newRoles = { ...roles, leader: true };

            batch.update(doc.ref, { roles: newRoles });
            updated++;
        }

        count++;
        if (updated % 400 === 0 && updated > 0) {
            // batch logic if needed, but 50 users is fine for one batch
        }
    });

    if (updated > 0) {
        await batch.commit();
    }

    console.log(`\nScanned ${count} users.`);
    console.log(`Updated ${updated} users to have 'leader' role.`);
}

fixRoles();
