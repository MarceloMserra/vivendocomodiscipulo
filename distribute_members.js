const { db } = require('./src/config/firebase');

async function distributeMembers() {
    console.log("--- DISTRIBUTING ORPHAN MEMBERS (ROUND-ROBIN) ---");

    // 1. Get Leaders and Supervisors (Potential Parents)
    const leadersSnap = await db.collection('users').where('roles.leader', '==', true).get();
    const leaders = leadersSnap.docs.map(d => ({ uid: d.id, name: d.data().displayName, groupId: d.data().groupId }));

    if (leaders.length === 0) {
        console.log("No leaders found to assign members to.");
        return;
    }

    // 2. Get Orphan Members (Test users only)
    const membersSnap = await db.collection('users').where('roles.member', '==', true).get();
    const orphans = membersSnap.docs.filter(d => {
        const u = d.data();
        // Only target 'teste.com' users or those without connection
        return (!u.leaderUid && u.email.includes("teste.com") && !u.roles.leader && !u.roles.supervisor && !u.roles.admin);
    });

    console.log(`Found ${orphans.length} orphan test members.`);

    // 3. Assign
    let leaderIndex = 0;
    for (const memberDoc of orphans) {
        const leader = leaders[leaderIndex];

        console.log(`   + Linking ${memberDoc.data().displayName || memberDoc.data().email} -> ${leader.name}`);

        await memberDoc.ref.update({
            leaderUid: leader.uid,
            groupId: leader.groupId || null
        });

        // Round Robin
        leaderIndex = (leaderIndex + 1) % leaders.length;
    }

    console.log("✅ Distribution complete.");
}

distributeMembers().then(() => process.exit());
