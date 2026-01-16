const { db } = require('./src/config/firebase');

async function listUsers() {
    console.log("--- LISTING USERS ---");
    const snapshot = await db.collection('users').limit(20).get();

    if (snapshot.empty) {
        console.log("No users found.");
        return;
    }

    snapshot.docs.forEach(doc => {
        const d = doc.data();
        console.log(`UID: ${doc.id} | Name: "${d.displayName}" | Email: ${d.email} | Roles: ${JSON.stringify(d.roles)}`);
    });
}

listUsers().then(() => process.exit());
