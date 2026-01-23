const { db } = require('../config/firebase');

async function findAdmin() {
    try {
        console.log("Searching for Admin User 'Marcelo'...");
        const snapshot = await db.collection('users').get();
        let found = false;
        snapshot.forEach(doc => {
            const d = doc.data();
            // Check for name match or role
            const name = d.displayName || d.name || '';
            if (name.toLowerCase().includes('marcelo') || (d.roles && d.roles.admin)) {
                console.log(`\n--- FOUND CANDIDATE ---`);
                console.log(`UID: ${doc.id}`);
                console.log(`Name: ${name}`);
                console.log(`Email: ${d.email}`);
                console.log(`Roles: ${JSON.stringify(d.roles)}`);
                found = true;
            }
        });

        if (!found) console.log("No user found with name 'Marcelo' or Admin role.");

    } catch (e) {
        console.error(e);
    }
}

findAdmin();
