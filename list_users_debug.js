const { db } = require('./src/config/firebase');

async function listUsers() {
    console.log("📋 Listando Usuários (Limit 50)...");
    const snapshot = await db.collection('users').limit(50).get();

    snapshot.forEach(doc => {
        const u = doc.data();
        console.log(`User: ${u.name} \t| Role: ${u.role} \t| Email: ${u.email} \t| UID: ${doc.id}`);
    });
}
listUsers();
