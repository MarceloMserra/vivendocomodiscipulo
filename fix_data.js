const { db } = require('./src/config/firebase');

async function fixData() {
    console.log("--- FIXING DATA FOR SUPERVISOR CARLOS ---");
    const uid = "ur9GjTD5yAgf29FuUpvnWvQZYEh1";

    // 1. Fix User Role
    console.log("Updating User Roles...");
    await db.collection('users').doc(uid).update({
        roles: { supervisor: true, member: true, leader: true } // Give him power for demo
    });
    console.log("✅ User roles updated to Supervisor.");

    // 2. Link a Group to this Supervisor
    // Let's find a group and assign him as supervisor
    const groupsSnap = await db.collection('groups').limit(1).get();
    if (!groupsSnap.empty) {
        const group = groupsSnap.docs[0];
        console.log(`Linking Group '${group.id}' to Supervisor...`);
        await group.ref.update({
            supervisorUid: uid
        });
        console.log("✅ Group linked.");
    } else {
        console.log("⚠️ No groups found to link. Creating one...");
        await db.collection('groups').add({
            leaderName: "Lider Teste",
            leaderUid: "legacy_leader_uid",
            supervisorUid: uid,
            members: [
                { uid: "member1", name: "Ovelha 1", role: "membro" },
                { uid: "member2", name: "Ovelha 2", role: "membro" }
            ]
        });
        console.log("✅ Test Group created and linked.");
    }
}

fixData().then(() => {
    console.log("Done.");
    process.exit();
});
