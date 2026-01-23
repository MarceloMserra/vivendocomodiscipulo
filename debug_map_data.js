const { db } = require('./src/config/firebase');

async function debugMapData() {
    console.log("--- DEBUGGING MAP DATA ---");

    // 1. Find Joao
    const joaoSnap = await db.collection("users").where("email", "==", "joao@teste.com").get();
    if (joaoSnap.empty) {
        console.log("❌ Joao not found!");
    } else {
        const joao = joaoSnap.docs[0].data();
        console.log(`User: ${joao.displayName}`);
        console.log(`   - pgmId: ${joao.pgmId}`);
        console.log(`   - leaderUid: ${joao.leaderUid}`);
    }

    // 2. Find Arthur
    const arthurSnap = await db.collection("users").where("displayName", ">=", "Arthur").limit(1).get();
    if (arthurSnap.empty) {
        console.log("❌ Arthur not found!");
    } else {
        const arthur = arthurSnap.docs[0].data();
        const arthurUid = arthurSnap.docs[0].id;
        console.log(`Leader: ${arthur.displayName} (UID: ${arthurUid})`);
        console.log(`   - pgmId (personal): ${arthur.pgmId}`);

        // Check PGM Doc
        const pgmSnap = await db.collection("pgms").where("leaderUid", "==", arthurUid).get();
        if (pgmSnap.empty) {
            console.log("❌ Arthur has NO 'pgms' document.");
        } else {
            pgmSnap.forEach(d => {
                const p = d.data();
                console.log(`   - PGM Doc [${d.id}]: ${p.name}`);
                console.log(`     - supervisorUid: ${p.supervisorUid}`);
                console.log(`     - active: ${p.active}`);
            });
        }
    }
    process.exit();
}

debugMapData();
