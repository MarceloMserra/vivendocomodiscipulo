const { db } = require('./src/config/firebase');

async function verifyFix() {
    console.log("--- VERIFYING CONTROLLER LOGIC FIX ---");

    // 1. SIMULATE "ALL USERS" QUERY (No Filter)
    // Old Controller used .orderBy("name")
    // New Controller uses .orderBy("displayName")

    console.log("\n[1] Testing 'All Users' Query (orderBy displayName):");
    try {
        const snapshot = await db.collection("users").orderBy("displayName").get();
        console.log(`   ✅ Found ${snapshot.size} users.`);

        const names = snapshot.docs.map(d => d.data().displayName);
        console.log(`   First 3: ${names.slice(0, 3).join(", ")}`);

        // Check for Matheus Maemo specifically to see why he appeared before
        const matheus = snapshot.docs.find(d => d.data().name === "Matheus Maemo" || d.data().displayName === "Matheus Maemo");
        if (matheus) console.log(`   (Matheus found at UID: ${matheus.id})`);

    } catch (e) {
        console.error("   ❌ Query Failed:", e.message);
    }

    // 2. SIMULATE "LEADERS" FILTER (V3 Role)
    console.log("\n[2] Testing 'Leaders' Filter (roles.leader == true):");
    const leaders = await db.collection("users").where("roles.leader", "==", true).get();
    console.log(`   ✅ Found ${leaders.size} Leaders.`);
    leaders.docs.forEach(d => console.log(`      - ${d.data().displayName}`));

}

verifyFix().then(() => process.exit());
