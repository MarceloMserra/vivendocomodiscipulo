const { db } = require('./src/config/firebase');

async function healNetwork() {
    console.log("--- HEALING NETWORK (SYNC V2 -> V3) ---");

    // 1. Get all Leaders
    const leadersSnap = await db.collection('users').where('roles.leader', '==', true).get();
    console.log(`Found ${leadersSnap.size} Leaders.`);

    for (const doc of leadersSnap.docs) {
        const leader = doc.data();
        const leaderUid = doc.id;
        const leaderName = leader.displayName || "Líder Sem Nome";

        console.log(`\nProcessing Leader: ${leaderName} (${leaderUid})...`);

        // 2. Find their Members (Legacy Source of Truth)
        const membersSnap = await db.collection('users').where('leaderUid', '==', leaderUid).get();
        const memberList = membersSnap.docs.map(m => ({
            uid: m.id,
            name: m.data().displayName || "Membro",
            role: "membro"
        }));
        console.log(`   -> Found ${memberList.length} members linked in Users collection.`);

        // 3. Find or Create PGM Group
        const groupsSnap = await db.collection('pgms').where('leaderUid', '==', leaderUid).get();

        let groupRef;
        if (!groupsSnap.empty) {
            console.log("   -> Group exists. Syncing members...");
            groupRef = groupsSnap.docs[0].ref;
            await groupRef.update({
                members: memberList, // Overwrite with fresh list
                active: true,
                leaderName: leaderName, // Ensure name is current
                supervisorUid: leader.leaderUid || null // Ensure supervisor link
            });
        } else {
            console.log("   -> NO Group found. Creating new PGM...");
            const newGroup = {
                leaderUid: leaderUid,
                leaderName: leaderName,
                supervisorUid: leader.leaderUid || null,
                members: memberList,
                createdAt: new Date(),
                active: true,
                meetingDay: 'Terça',
                meetingTime: '20:00'
            };
            const res = await db.collection('pgms').add(newGroup);
            groupRef = res;

            // Link Leader to new Group
            await db.collection('users').doc(leaderUid).update({
                groupId: res.id
            });
        }

        console.log("   ✅ Group Synced.");
    }
}

healNetwork().then(() => {
    console.log("\n--- NETWORK HEALED ---");
    process.exit();
});
