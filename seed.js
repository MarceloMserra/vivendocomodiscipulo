const { db, auth } = require('./src/config/firebase');

async function seed() {
    console.log("🌱 Iniciando Seeding...");

    // 1. Identificar Admin para salvar
    console.log("🔍 Buscando Admin para preservar...");
    const adminSnapshot = await db.collection('users').where('role', '==', 'admin').get();
    let adminUid = null;

    if (adminSnapshot.empty) {
        console.error("❌ Nenhum admin encontrado! Abortando para não perder acesso.");
        process.exit(1);
    }

    // Assume o primeiro admin encontrado como o "dono" (Marcelo)
    const adminDoc = adminSnapshot.docs[0];
    adminUid = adminDoc.id;
    console.log(`✅ Admin preservado: ${adminDoc.data().name} (${adminUid})`);

    // 2. Deletar todos os outros usuários
    console.log("🗑️ Deletando outros usuários...");
    const usersSnap = await db.collection('users').get();
    const deletePromises = [];

    usersSnap.forEach(doc => {
        if (doc.id !== adminUid) {
            deletePromises.push(db.collection('users').doc(doc.id).delete());
            // Nota: Deletar do Auth também seria ideal, mas requer Admin SDK com privilégio total de Auth.
            // O código atual usa 'admin' importado de firebase.js que tem serviceAccount?
            // Se sim, podemos tentar deletar do Auth.
            // Mas para o teste rápido de DB, deletar do Firestore resolve a lista.
        }
    });

    await Promise.all(deletePromises);
    console.log(`🗑️ ${deletePromises.length} usuários removidos.`);

    // 3. Criar Usuários Dummy
    console.log("🔨 Criando novos usuários...");

    const newUsers = [
        { name: "Líder João", role: "lider", email: "lider1@teste.com", pgmId: "pgm_lider1" },
        { name: "Líder Maria", role: "lider", email: "lider2@teste.com", pgmId: "pgm_lider2" },
        { name: "Sueprvisor Carlos", role: "supervisor", email: "sup1@teste.com" },
        { name: "Supervisor Ana", role: "supervisor", email: "sup2@teste.com" },
    ];

    // Criar 10 Membros
    for (let i = 1; i <= 10; i++) {
        newUsers.push({
            name: `Membro ${i}`,
            role: "membro",
            email: `membro${i}@teste.com`,
            // Distribuir entre os grupos dos líderes criados acima
            pgmId: i <= 5 ? "pgm_lider1" : "pgm_lider2",
            leaderName: i <= 5 ? "Líder João" : "Líder Maria"
        });
    }

    // Função auxiliar para criar no Auth e Firestore
    // Como não temos a senha do user real aqui facilmente para criar no Auth via Client SDK,
    // vamos usar o Admin SDK para criar usuários com senha padrão "123456".

    const { getAuth } = require('firebase-admin/auth'); // Usando Admin SDK auth

    for (const u of newUsers) {
        try {
            // Criar no Auth
            // Verifica se ja existe por email para não dar erro
            try {
                const existingUser = await getAuth().getUserByEmail(u.email);
                await getAuth().deleteUser(existingUser.uid);
            } catch (e) { } // Ignora se nao existe

            const userRecord = await getAuth().createUser({
                email: u.email,
                password: 'password123',
                displayName: u.name,
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`
            });

            // Criar no Firestore
            await db.collection('users').doc(userRecord.uid).set({
                name: u.name,
                name_lower: u.name.toLowerCase(), // FIELD FOR SEARCH
                email: u.email,
                role: u.role,
                pgmId: u.pgmId || null,
                leaderName: u.leaderName || null,
                photoUrl: userRecord.photoURL,
                createdAt: new Date().toISOString()
            });

            console.log(`✅ Criado: ${u.name} (${u.role})`);
        } catch (e) {
            console.error(`❌ Erro ao criar ${u.name}:`, e.message);
        }
    }

    console.log("🏁 Seeding concluído!");
    console.log("🔑 Senha padrão para todos: password123");
    process.exit(0);
}

seed();
