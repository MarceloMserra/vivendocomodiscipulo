const { db } = require('./src/config/firebase');

async function listLeaders() {
    console.log("📋 Listando Líderes/Supervisores...");
    // Try multiple possible role values
    const snapshot = await db.collection('users').get();

    snapshot.forEach(doc => {
        const u = doc.data();
        if (u.role === 'lider' || u.role === 'admin' || u.role === 'supervisor') {
            console.log(`User: ${u.name} \t| Role: ${u.role} \t| UID: ${doc.id}`);
        }
        // Also check if name contains Arthur
        if (u.name && u.name.includes("Arthur")) {
            console.log(`🎯 POSSÍVEL ALVO: ${u.name} \t| UID: ${doc.id} \t| Role: ${u.role}`);
        }
    });
}
listLeaders();
