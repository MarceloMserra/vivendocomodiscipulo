const { db } = require('./src/config/firebase');

async function checkSpecificMembers() {
    console.log("🔍 Verificando se os membros existem no banco...");
    const targets = ["Bruno", "Phelipe", "Rafael", "Marcelo Serra"];

    for (const name of targets) {
        const snap = await db.collection('users').where('name', '==', name).get();
        if (snap.empty) {
            console.log(`❌ ${name} NÃO ENCONTRADO.`);
        } else {
            snap.forEach(doc => {
                const d = doc.data();
                console.log(`✅ ${d.name} existe!`);
                console.log(`   - UID: ${doc.id}`);
                console.log(`   - Roles: ${JSON.stringify(d.roles)}`);
                console.log(`   - LeaderUID: ${d.leaderUid}`);
            });
        }
    }
}

checkSpecificMembers();
