const { db, admin } = require('./src/config/firebase');

async function resetAndSeed() {
    console.log("--- 🚨 RESETTING DATABASE & SEEDING V3 DATA 🚨 ---");

    // 1. IDENTIFY ADMIN (DO NOT DELETE)
    const adminEmail = "mmdigital001@gmail.com";
    const adminSnap = await db.collection('users').where('email', '==', adminEmail).get();

    if (adminSnap.empty) {
        console.error("❌ CRITICAL: Admin user not found. Aborting to prevent lockout.");
        process.exit(1);
    }
    const adminUser = adminSnap.docs[0];
    const adminUid = adminUser.id;
    console.log(`✅ Preserving Admin: ${adminUser.data().displayName} (${adminUid})`);

    // 2. WIPE ALL OTHER USERS
    console.log("\n💥 Deleting legacy users...");
    const allUsers = await db.collection('users').get();
    const batchSize = 100;
    let batch = db.batch();
    let count = 0;

    for (const doc of allUsers.docs) {
        if (doc.id === adminUid) continue; // Skip Admin

        batch.delete(doc.ref);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % batchSize !== 0) await batch.commit();
    console.log(`   Deleted ${count} users.`);

    // Wipe PGMS/Groups collection too (to be clean)
    console.log("💥 Deleting old groups...");
    const allGroups = await db.collection('pgms').get();
    allGroups.docs.forEach(d => d.ref.delete()); // Async but fast enough for small set

    // 3. SEED NEW HIERARCHY
    // Target: 3 Supervisors, 4 Leaders, 10 Members
    console.log("\n🌱 Seeding new data...");

    const supervisors = [];
    const leaders = [];
    const members = [];

    // A. Create 3 Supervisors
    for (let i = 1; i <= 3; i++) {
        const ref = await db.collection('users').add({
            displayName: `Supervisor ${i}`,
            email: `sup${i}@teste.com`,
            roles: { supervisor: true, member: true },
            leaderUid: adminUid, // Supervisors report to Admin
            photoURL: `https://ui-avatars.com/api/?name=Supervisor+${i}&background=random&color=fff`,
            createdAt: new Date()
        });
        supervisors.push({ uid: ref.id, name: `Supervisor ${i}` });
        console.log(`   + Supervisor ${i}`);
    }

    // B. Create 4 Leaders (Distribute among 3 Supervisors + Admin)
    // Supervisor 1 gets 1, Sup 2 gets 1, Sup 3 gets 1, Admin gets 1? 
    // Or Sup 1 (2), Sup 2 (1), Sup 3 (1). Let's do Round Robin.
    const allSupSources = [...supervisors, { uid: adminUid, name: "Admin" }];

    for (let i = 1; i <= 4; i++) {
        const parent = allSupSources[(i - 1) % allSupSources.length];
        const ref = await db.collection('users').add({
            displayName: `Líder ${i}`,
            email: `lider${i}@teste.com`,
            roles: { leader: true, member: true },
            leaderUid: parent.uid,
            photoURL: `https://ui-avatars.com/api/?name=Lider+${i}&background=random&color=fff`,
            createdAt: new Date()
        });
        leaders.push({ uid: ref.id, name: `Líder ${i}`, parent: parent.name });

        // Create PGM Group for them (V3 Standard)
        await db.collection('pgms').add({
            leaderUid: ref.id,
            leaderName: `Líder ${i}`,
            supervisorUid: parent.uid,
            active: true,
            createdAt: new Date()
        });

        console.log(`   + Líder ${i} (Reports to ${parent.name})`);
    }

    // C. Create 10 Members (Distribute among 4 Leaders)
    for (let i = 1; i <= 10; i++) {
        const leader = leaders[(i - 1) % leaders.length];
        await db.collection('users').add({
            displayName: `Membro ${i}`,
            email: `membro${i}@teste.com`,
            roles: { member: true },
            leaderUid: leader.uid,
            photoURL: `https://ui-avatars.com/api/?name=Membro+${i}&background=random&color=fff`,
            createdAt: new Date()
        });
        console.log(`   + Membro ${i} (Reports to ${leader.name})`);
    }

    console.log("\n✅ DATABASE RESET & SEEDED SUCCESSFULLY.");
}

resetAndSeed().then(() => process.exit());
