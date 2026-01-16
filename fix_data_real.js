const { db } = require('./src/config/firebase');

async function fixDataReal() {
    console.log("--- FIXING DATA WITH REAL UIDS (PGMS COLLECTION) ---");

    const supervisorUid = "ur9GjTD5yAgf29FuUpvnWvQZYEh1"; // Carlos
    const leaderUid = "8KCTMBNJVjMepZ0UZ7Y4LF7MA6s2"; // Random User 1
    const memberUid = "ERrzIMixtsU1Frkt88vTFbiAkpA2"; // Random User 2

    // 1. Setup Supervisor
    await db.collection('users').doc(supervisorUid).update({
        displayName: "Supervisor Carlos",
        roles: { supervisor: true, member: true, admin: true } // Grant Admin for Global View
    });
    console.log("✅ Supervisor Setup");

    // 2. Setup Leader
    await db.collection('users').doc(leaderUid).update({
        displayName: "Líder João",
        roles: { leader: true, member: true },
        leaderUid: supervisorUid // Optional, but good for direct check
    });
    console.log("✅ Leader Setup");

    // 3. Setup Member
    await db.collection('users').doc(memberUid).update({
        displayName: "Ovelha Maria",
        roles: { member: true },
        leaderUid: leaderUid
    });
    console.log("✅ Member Setup");

    // 4. Update Group in PGMS collection
    const groupsSnap = await db.collection('pgms').where('supervisorUid', '==', supervisorUid).get();

    if (!groupsSnap.empty) {
        const group = groupsSnap.docs[0];
        console.log(`Updating Group ${group.id}...`);
        await group.ref.update({
            leaderUid: leaderUid,
            leaderName: "Líder João",
            members: [
                { uid: memberUid, name: "Ovelha Maria", role: "membro" }
            ],
            active: true // Necessary for findByLeader
        });
        console.log("✅ Group structure updated.");
    } else {
        console.log("Creating new group...");
        await db.collection('pgms').add({
            supervisorUid: supervisorUid,
            leaderUid: leaderUid,
            leaderName: "Líder João",
            members: [
                { uid: memberUid, name: "Ovelha Maria", role: "membro" }
            ],
            active: true
        });
        console.log("✅ Group created.");
    }
}

fixDataReal().then(() => {
    console.log("Done.");
    process.exit();
});
