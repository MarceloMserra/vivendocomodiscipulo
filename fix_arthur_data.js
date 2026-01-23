const { db, admin } = require('./src/config/firebase');

async function fixArthur() {
    console.log("🛠️ Corrigindo dados do Arthur...");

    try {
        // 1. Find ALL Arthurs
        const snapshot = await db.collection('users').where('name', '>=', 'Arthur').where('name', '<=', 'Arthur\uf8ff').get();

        let originalArthur = null;
        let fakeArthur = null;

        snapshot.forEach(doc => {
            const u = doc.data();
            console.log(`🔎 Encontrado: ${u.name} | Email: ${u.email} | Role: ${u.role} | UID: ${doc.id}`);

            if (u.email === 'arthur@teste.com') {
                fakeArthur = { id: doc.id, ...u };
            } else {
                // Assuming the first non-test Arthur is the real one, or looks for specific characteristics
                // User said "Arthur que ja tinha antes".
                if (!originalArthur) originalArthur = { id: doc.id, ...u };
            }
        });

        if (!originalArthur) {
            console.error("❌ ERRO: Não encontrei o Arthur original! Abortando para não piorar.");
            return;
        }

        if (!fakeArthur) {
            console.log("⚠️ Arthur fake não encontrado (talvez já deletado?). Seguindo apenas com update de membros.");
        }

        console.log(`\n✅ ORIGINAL: ${originalArthur.name} (${originalArthur.id})`);
        if (fakeArthur) console.log(`❌ FAKE: ${fakeArthur.name} (${fakeArthur.id})`);

        // 2. Move New Members to Original Arthur
        const newMembers = ["Bruno", "Phelipe", "Rafael", "Marcelo Serra"];

        // Find these users
        const membersSnap = await db.collection('users').where('name', 'in', newMembers).get();
        if (membersSnap.empty) {
            console.log("⚠️ Nenhum dos novos membros encontrado.");
        } else {
            const batch = db.batch();
            membersSnap.forEach(doc => {
                console.log(`Move ${doc.data().name} to Leader ${originalArthur.id}`);
                batch.update(doc.ref, { leaderUid: originalArthur.id });
            });
            await batch.commit();
            console.log("✅ Membros movidos para o Arthur original.");
        }

        // 3. Delete Fake Arthur and his Group
        if (fakeArthur) {
            console.log("🗑️ Deletando Arthur Fake e seu Grupo...");
            await db.collection('users').doc(fakeArthur.id).delete();

            const groupSnap = await db.collection('pgms').where('leaderUid', '==', fakeArthur.id).get();
            groupSnap.forEach(async g => {
                console.log(`   -> Deletando PGM Fake: ${g.data().name}`);
                await g.ref.delete();
            });
            console.log("✅ Limpeza concluída.");
        }

    } catch (e) {
        console.error("Erro:", e);
    }
}

fixArthur();
