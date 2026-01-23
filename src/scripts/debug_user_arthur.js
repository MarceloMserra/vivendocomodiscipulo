const { db, admin } = require('../config/firebase');

async function debugArthur() {
    console.log("Searching for Arthur...");
    // Search by email
    const usersSnap = await db.collection('users').where('email', '==', 'arthur@pgm.com').get();

    if (usersSnap.empty) {
        console.log("USER NOT FOUND via email query!");

        // Try listing all to see if name matches
        console.log("Listing all users to fuzzy find Arthur...");
        const all = await db.collection('users').get();
        all.forEach(doc => {
            const d = doc.data();
            if (d.displayName && d.displayName.toLowerCase().includes('arthur')) {
                console.log(`Found similar: ${d.displayName} (${d.email}) - UID: ${doc.id}`);
            }
        });
    } else {
        usersSnap.forEach(doc => {
            console.log(`FOUND User: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }
}

debugArthur();
