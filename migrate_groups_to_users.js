const { db } = require('./src/config/firebase');

async function migrateGroupsToUsers() {
    console.log("--- MIGRATING GROUPS -> USER LINKS (V3) ---");

    const groupsSnap = await db.collection('pgms').get();
    console.log(`Found ${groupsSnap.size} groups.`);

    for (const groupDoc of groupsSnap.docs) {
        const group = groupDoc.data();
        const leaderUid = group.leaderUid;
        const supervisorUid = group.supervisorUid;
        const members = group.members || [];

        console.log(`\nProcessing Group Leader: ${group.leaderName}`);

        // 1. Link Leader -> Supervisor
        if (leaderUid && supervisorUid) {
            console.log(`   + Linking Leader (${leaderUid}) -> Supervisor (${supervisorUid})`);
            await db.collection('users').doc(leaderUid).update({
                leaderUid: supervisorUid
            });
        } else {
            console.warn(`   ! Missing LeaderUID or SupervisorUID for group.`);
        }

        // 2. Link Members -> Leader
        console.log(`   + Linking ${members.length} Members -> Leader (${leaderUid})`);

        // Members array in group might store objects { uid, name } or strings. Check structure.
        for (const m of members) {
            const memberUid = m.uid || m.id || (typeof m === 'string' ? m : null);
            if (memberUid) {
                // Determine valid role (don't overwrite 'leader' if they are one)
                // Just update leaderUid
                await db.collection('users').doc(memberUid).update({
                    leaderUid: leaderUid
                });
            }
        }
    }

    // 3. Link Supervisors -> Admin (Optional, but good for completeness?)
    // Actually Admin View grabs all Supervisors, so this isn't strictly needed for the view,
    // but good for data consistency if we ever have "Main Supervisor".
    // For now, we skip to avoid forcing a single root if multiple Admins exist.
}

migrateGroupsToUsers().then(() => {
    console.log("\n✅ Migration Complete.");
    process.exit();
});
