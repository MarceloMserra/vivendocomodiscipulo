const { db } = require('./src/config/firebase');

async function createBalancedData() {
    console.log("--- CREATING BALANCED DEMO DATA ---");

    // 1. Get Supervisors
    const supervisors = [
        { uid: "ur9GjTD5yAgf29FuUpvnWvQZYEh1", name: "Supervisor Carlos" },
        { uid: "dummy_supervisor_1", name: "Supervisor Dummy" },
        { uid: "nrfbUohhw1WWV9l5ZMXTHhK9mmC2", name: "Marcelo Madureira" }, // Admin acting as Sup
        { uid: "6bOa3njeynYH9FiLMusYXMJYC9N2", name: "Supervisor Ana" } // Using the UID from analysis log
    ];

    // 2. Identify Existing Leaders
    const existingLeadersSnap = await db.collection('users').where('roles.leader', '==', true).get();
    let leaders = existingLeadersSnap.docs.map(d => ({ uid: d.id, name: d.data().displayName || d.data().email }));

    console.log(`Initial Leaders: ${leaders.length}`);

    // 3. Create Missing Leaders (Target: 4)
    if (leaders.length < 4) {
        const needed = 4 - leaders.length;
        console.log(`Creating ${needed} new dummy leaders...`);

        for (let i = 0; i < needed; i++) {
            const newLeaderRef = await db.collection('users').add({
                displayName: `Líder Demo ${i + 1}`,
                email: `lider_demo_${i + 1}@teste.com`,
                roles: { leader: true, member: true },
                createdAt: new Date(),
                photoURL: `https://ui-avatars.com/api/?name=Lider+Demo+${i + 1}&background=random`
            });
            leaders.push({ uid: newLeaderRef.id, name: `Líder Demo ${i + 1}` });
            console.log(`   + Created ${leaders[leaders.length - 1].name}`);
        }
    }

    // 4. Distribute Leaders Round-Robin
    console.log("\nDistributing Leaders...");

    for (let i = 0; i < leaders.length; i++) {
        const leader = leaders[i];
        const supervisor = supervisors[i % supervisors.length]; // Round robin

        console.log(`   * Assigning ${leader.name} -> ${supervisor.name}`);

        await db.collection('users').doc(leader.uid).update({
            leaderUid: supervisor.uid
        });

        // Also ensure they have a PGM Group (V3 Requirement for visibility in some panels)
        const pgmSnap = await db.collection('pgms').where('leaderUid', '==', leader.uid).get();
        if (pgmSnap.empty) {
            await db.collection('pgms').add({
                leaderUid: leader.uid,
                leaderName: leader.name,
                supervisorUid: supervisor.uid,
                members: [],
                active: true,
                createdAt: new Date()
            });
            console.log(`     -> Created PGM group for ${leader.name}`);
        } else {
            await pgmSnap.docs[0].ref.update({ supervisorUid: supervisor.uid });
        }
    }

    console.log("\n✅ Hierarchy Balanced.");
}

createBalancedData().then(() => process.exit());
