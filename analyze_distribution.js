const { db } = require('./src/config/firebase');

async function analyzeDistribution() {
    console.log("--- ANALYZING HIERARCHY DISTRIBUTION ---");

    // 1. Get Supervisors
    const supSnap = await db.collection('users').where('roles.supervisor', '==', true).get();
    const supervisors = supSnap.docs.map(d => ({ uid: d.id, name: d.data().displayName }));
    console.log(`\nFound ${supervisors.length} Supervisors:`);
    supervisors.forEach(s => console.log(`   [${s.uid}] ${s.name}`));

    // 2. Get Known Leaders (Role = Leader)
    const leaderSnap = await db.collection('users').where('roles.leader', '==', true).get();

    console.log(`\nFound ${leaderSnap.size} Users with 'roles.leader':`);
    leaderSnap.docs.forEach(d => {
        const u = d.data();
        const sup = supervisors.find(s => s.uid === u.leaderUid);
        const supName = sup ? sup.name : `UNKNOWN (${u.leaderUid})`;
        console.log(`   - ${u.displayName || u.email} (UID: ${d.id}) -> Connected to: ${supName}`);
    });

    // 3. Hunt for "Hidden" Leaders (Email heuristic)
    const allUsers = await db.collection('users').get();
    const potentialLeaders = allUsers.docs.filter(d => {
        const u = d.data();
        return u.email && u.email.includes('lider') && !u.roles.leader;
    });

    if (potentialLeaders.length > 0) {
        console.log(`\n⚠️ Found ${potentialLeaders.length} Potentially Missing Leaders (by email):`);
        potentialLeaders.forEach(d => console.log(`   - ${d.data().email} (UID: ${d.id})`));
    }
}

analyzeDistribution().then(() => process.exit());
