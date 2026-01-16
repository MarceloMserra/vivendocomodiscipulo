const { db } = require('./src/config/firebase');

async function debugFilters() {
    console.log("--- DEBUGGING INDIVIDUAL FILTERS ---");

    const filters = ['membro', 'lider', 'supervisor', 'admin'];

    for (const f of filters) {
        console.log(`\nTesting Filter: '${f}'`);

        // REPLICATE CONTROLLER LOGIC EXACTLY
        let query = db.collection("users");

        // Controller Mapping
        let dbRole = f;
        if (f === 'lider') dbRole = 'leader';
        if (f === 'membro') dbRole = 'member';

        console.log(`   -> Mapped '${f}' to DB Field: 'roles.${dbRole}'`);

        query = query.where(`roles.${dbRole}`, "==", true);

        try {
            const snapshot = await query.get();
            console.log(`   ✅ Result: Found ${snapshot.size} users.`);

            if (snapshot.size > 0) {
                const names = snapshot.docs.map(d => d.data().displayName);
                console.log(`      (${names.slice(0, 3).join(', ')}...)`);
            } else {
                console.log("      ❌ EMPTY LIST - Filter returned nothing.");
            }

        } catch (e) {
            console.error("   ❌ QUERY ERROR:", e.message);
        }
    }
}

debugFilters().then(() => process.exit());
