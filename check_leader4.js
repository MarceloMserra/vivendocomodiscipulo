const { db } = require('./src/config/firebase');

async function checkLeader4() {
    console.log("--- DIAGNOSTIC: FINDING LEADER 4 ---");

    // 1. Find 'Líder 4'
    const snapshot = await db.collection("users").get();
    let leader4 = null;

    snapshot.forEach(doc => {
        const d = doc.data();
        if ((d.displayName && d.displayName.includes("Líder 4")) || (d.name && d.name.includes("Líder 4"))) {
            leader4 = { id: doc.id, ...d };
        }
    });

    if (!leader4) {
        console.error("❌ 'Líder 4' NOT FOUND in database.");
        return;
    }

    console.log(`✅ Found 'Líder 4': ${leader4.displayName} (UID: ${leader4.id})`);
    console.log(`   - Role: ${JSON.stringify(leader4.roles)}`);
    console.log(`   - Leader UID: ${leader4.leaderUid}`);

    // 2. Check Hierarchy
    if (!leader4.leaderUid) {
        console.error("   ❌ DISCONNECTED: Has no 'leaderUid'. This is why they don't appear in the Tree.");
        // Attempt to find a Supervisor to attach them to
    } else {
        const bossDoc = await db.collection("users").doc(leader4.leaderUid).get();
        if (bossDoc.exists) {
            console.log(`   ✅ Reports to: ${bossDoc.data().displayName} (${bossDoc.id})`);
        } else {
            console.error(`   ❌ BROKEN LINK: Reports to non-existent UID (${leader4.leaderUid})`);
        }
    }
}

checkLeader4().then(() => process.exit());
