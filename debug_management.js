const { db } = require('./src/config/firebase');

async function debugManagementQueries() {
    console.log("--- DEBUGGING MANAGEMENT QUERIES ---");

    // 1. REPRODUCE "DASHBOARD STATS" BUG
    // Current Code: db.collection("users").where("role", "==", "lider").count()
    // This relies on the old top-level 'role' string.
    console.log("\n[1] Testing Stats Queries (Legacy vs V3):");

    // Legacy
    const legacyLeaders = (await db.collection("users").where("role", "==", "lider").count().get()).data().count;
    const legacySups = (await db.collection("users").where("role", "==", "supervisor").count().get()).data().count;

    // V3 (Correct)
    const v3Leaders = (await db.collection("users").where("roles.leader", "==", true).count().get()).data().count;
    const v3Sups = (await db.collection("users").where("roles.supervisor", "==", true).count().get()).data().count;

    console.log(`   Leaders: Legacy=${legacyLeaders} | V3 (Real)=${v3Leaders}`);
    console.log(`   Supervisors: Legacy=${legacySups} | V3 (Real)=${v3Sups}`);

    if (legacyLeaders !== v3Leaders) console.log("   ❌ Discrepancy detected in Leaders count.");

    // 2. REPRODUCE "FILTER" BUG
    // Current Code: db.collection("users").where("role", "==", roleFilter)
    console.log("\n[2] Testing Filter Queries:");

    // Try to find ANY leader using the legacy 'role' field
    const legacyLeaderDocs = await db.collection("users").where("role", "==", "lider").get();
    console.log(`   Legacy Query found: ${legacyLeaderDocs.size} docs`);
    legacyLeaderDocs.docs.forEach(d => console.log(`     - ${d.data().displayName || d.data().email}`));

    // Try to find ANY leader using V3
    const v3LeaderDocs = await db.collection("users").where("roles.leader", "==", true).get();
    console.log(`   V3 Query found: ${v3LeaderDocs.size} docs`);

}

debugManagementQueries().then(() => process.exit());
