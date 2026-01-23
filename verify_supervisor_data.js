const PGMService = require('./src/services/PGMService');
const User = require('./src/models/User');
const { db } = require('./src/config/firebase');

async function debugSupervisor() {
    console.log("--- DEBUGGING SUPERVISOR (TITO) ---");

    // 1. Find Tito
    const usersSnap = await db.collection('users').where('email', '==', 'tito@pgm.com').get();
    if (usersSnap.empty) {
        console.log("❌ Tito not found!");
        process.exit();
    }
    const tito = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };
    console.log(`User: ${tito.displayName} (UID: ${tito.id})`);
    console.log(`Roles:`, tito.roles);

    // 2. Test getDashboardData
    try {
        console.log("\n--- Testing getDashboardData ---");
        const dashData = await PGMService.getDashboardData(tito.id);
        console.log("Is Supervisor Mode:", dashData.isSupervisorMode);
        console.log("Supervised Groups:", dashData.supervisedGroups ? dashData.supervisedGroups.length : 0);
        if (dashData.supervisedGroups) {
            dashData.supervisedGroups.forEach(g => console.log(`   - PGM: ${g.name} (Leader: ${g.leaderName})`));
        }
    } catch (e) {
        console.error("❌ Error in getDashboardData:", e.message);
    }

    // 3. Test getMetrics
    try {
        console.log("\n--- Testing getMetrics ---");
        const metrics = await PGMService.getMetrics(tito.id);
        console.log("Metrics Returned:", metrics.length);
        metrics.forEach(m => {
            console.log(`   - ${m.groupName} (${m.leaderName}): Status=${m.status}, Inactive=${m.daysInactive}d`);
        });
    } catch (e) {
        console.error("❌ Error in getMetrics:", e.stack);
    }

    // 4. Debug Network (User.getNetwork)
    try {
        console.log("\n--- Debugging Network (Direct Reports) ---");
        const leaders = await User.getNetwork(tito.id);
        console.log(`Found ${leaders.length} direct reports.`);
        leaders.forEach(l => console.log(`   -> ${l.displayName} (UID: ${l.uid})`));

        // Check if ANYONE has leaderUid = Tito
        const rawCheck = await db.collection('users').where('leaderUid', '==', tito.id).get();
        console.log(`Raw DB Check (leaderUid == tito.id): ${rawCheck.size} docs.`);
    } catch (e) {
        console.error("Error debugging network:", e);
    }

    process.exit();
}

debugSupervisor();
