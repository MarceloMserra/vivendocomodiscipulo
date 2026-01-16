const { db } = require('./src/config/firebase');

async function moveLeader4() {
    console.log("--- RE-ASSIGNING LEADER 4 ---");

    // 1. Find Leader 4
    const usersSnap = await db.collection("users").get();
    let leader4 = null;
    let supervisor1 = null;

    usersSnap.forEach(doc => {
        const d = doc.data();
        if (d.displayName && d.displayName.includes("Líder 4")) leader4 = { id: doc.id, ...d };
        if (d.displayName && d.displayName.includes("Supervisor 1")) supervisor1 = { id: doc.id, ...d };
    });

    if (!leader4 || !supervisor1) {
        console.error("❌ Could not find Leader 4 or Supervisor 1.");
        return;
    }

    // 2. Update Leader 4 to report to Supervisor 1
    console.log(`Moves '${leader4.displayName}' FROM '${leader4.leaderUid}' TO '${supervisor1.displayName}' (${supervisor1.id})`);

    await db.collection("users").doc(leader4.id).update({
        leaderUid: supervisor1.id,
        pgmId: db.collection("users").doc(supervisor1.id) // legacy compat just in case
    });

    console.log("✅ MOVED SUCCESSFULLY. Leader 4 should now appear under Supervisor 1.");
}

moveLeader4().then(() => process.exit());
