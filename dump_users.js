const { db } = require('./src/config/firebase');
const fs = require('fs');

async function dumpUsers() {
    console.log("--- DUMPING ALL USERS ---");
    const snapshot = await db.collection('users').get();

    console.log(`Total Documents: ${snapshot.size}`);

    const users = [];
    snapshot.docs.forEach(doc => {
        const d = doc.data();
        users.push({
            uid: doc.id,
            displayName: d.displayName,
            email: d.email,
            roles: d.roles
        });
    });

    fs.writeFileSync('users_dump.json', JSON.stringify(users, null, 2));
    console.log("Dump written to users_dump.json");
}

dumpUsers().then(() => process.exit());
