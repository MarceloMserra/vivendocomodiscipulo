const { db, admin } = require('./src/config/firebase');

async function fixRoles() {
    console.log("🛠️ Corrigindo Funções (Force 'membro')...");

    const membersToFix = ["Bruno", "Phelipe", "Rafael", "Marcelo Serra"];

    // We also need to ensure they are linked to the REAL Arthur (arthur@pgm.com / gbDQgqS4iih2ZQPB4awCI2xTglJ2)
    // Let's find him dynamically to be safe, or hardcode if we are sure.
    // User confirmed Arthur is "Arthur" <arthur@pgm.com>

    const arthurSnap = await db.collection('users').where('email', '==', 'arthur@pgm.com').get();
    if (arthurSnap.empty) {
        console.error("❌ Arthur Original não encontrado para vincular.");
        return;
    }
    const arthurUid = arthurSnap.docs[0].id;
    console.log(`✅ Líder Alvo: Arthur (${arthurUid})`);

    const batch = db.batch();

    // Find these users by name
    const snap = await db.collection('users').where('name', 'in', membersToFix).get();

    snap.forEach(doc => {
        console.log(`   -> Ajustando: ${doc.data().name} (${doc.id})`);
        batch.update(doc.ref, {
            role: 'membro', // String legacy
            roles: {
                member: true,
                leader: false,
                supervisor: false,
                admin: false
            },
            leaderUid: arthurUid // Ensure link
        });
    });

    await batch.commit();
    console.log("✅ Correção de cargos concluída.");
}

fixRoles();
