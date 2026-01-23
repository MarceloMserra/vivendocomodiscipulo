const { db } = require('./src/config/firebase');

async function findUser(namePart) {
    console.log(`🔍 Buscando usuário com nome contendo: "${namePart}"...`);
    const snapshot = await db.collection('users')
        .where('name', '>=', namePart)
        .where('name', '<=', namePart + '\uf8ff')
        .get();

    if (snapshot.empty) {
        console.log("❌ Nenhume usuário encontrado.");
        return;
    }

    snapshot.forEach(doc => {
        const u = doc.data();
        console.log(`✅ Encontrado: ${u.name} (Role: ${u.role}) - UID: ${doc.id}`);
    });
}

findUser('Arthur');
