const { db } = require('./src/config/firebase');

async function debugHierarchy() {
    console.log("--- DEBUGGING HIERARCHY FOR MISSING NODES ---");

    // 1. Check Lider 2
    const lider2Uid = "oIjqVflgkafjzrBiDeDLCj9EFDr2"; // from dump
    const lider2Doc = await db.collection('users').doc(lider2Uid).get();

    if (!lider2Doc.exists) {
        console.log("❌ Lider 2 not found in DB");
    } else {
        const d = lider2Doc.data();
        console.log(`\n🔍 Lider 2 (${d.displayName}):`);
        console.log(`   - Roles:`, d.roles);
        console.log(`   - LeaderUid: ${d.leaderUid}`);

        // Check if he has a group
        const groupSnap = await db.collection('pgms').where('leaderUid', '==', lider2Uid).get();
        console.log(`   - Manages Group? ${!groupSnap.empty ? 'YES (ID: ' + groupSnap.docs[0].id + ')' : 'NO'}`);
        if (!groupSnap.empty) {
            const g = groupSnap.docs[0].data();
            console.log(`     - Group SupervisorUid: ${g.supervisorUid}`);
        }
    }

    // 2. Check Membro 1
    const membro1Uid = "I7JamSEypZaHUKEda8ruPdRhQNb2"; // from dump
    const membro1Doc = await db.collection('users').doc(membro1Uid).get();

    if (membro1Doc.exists) {
        const d = membro1Doc.data();
        console.log(`\n🔍 Membro 1 (${d.email}):`);
        console.log(`   - LeaderUid: ${d.leaderUid}`);
        console.log(`   - GroupId: ${d.groupId || d.pgmId}`);
    }

    // 3. Check All Groups
    console.log("\n--- LISTING ALL GROUPS (PGMS) ---");
    const groups = await db.collection('pgms').get();
    groups.docs.forEach(g => {
        const d = g.data();
        console.log(`[Group ${g.id}] Leader: ${d.leaderName} (${d.leaderUid}) | Supervisor: ${d.supervisorUid}`);
    });
}

debugHierarchy().then(() => process.exit());
