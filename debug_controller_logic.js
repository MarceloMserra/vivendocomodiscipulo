const { db } = require('./src/config/firebase');

async function debugController() {
    console.log("--- DEBUGGING CONTROLLER LOGIC ---");

    // Simulate Request Body from Frontend
    // Default load: { limit: 20, roleFilter: 'all' }
    const filters = {
        limit: 20,
        roleFilter: 'all',
        search: '',
        groupFilter: ''
    };

    console.log("Filters:", filters);

    let query = db.collection("users");

    // 1. REPLICATE CONTROLLER SORTING LOGIC
    // Logic in file: if (search) { ... } else if (!roleFilter && !groupFilter) { query = query.orderBy("displayName"); }

    // PROBLEM HYPOTHESIS: 'all' is truthy, so !'all' is false.
    // If roleFilter is 'all', the else-if block is SKIPPED.
    // So query has NO .orderBy().

    if (filters.search) {
        console.log("   -> Adding Search Sort");
        const searchLower = filters.search.toLowerCase();
        query = query.orderBy("name_lower").startAt(searchLower).endAt(searchLower + '\uf8ff');
    } else if ((!filters.roleFilter || filters.roleFilter === 'all') && !filters.groupFilter) {
        console.log("   -> Adding Default Sort (displayName)");
        query = query.orderBy("displayName");
    } else {
        console.log("   -> NO SORTING APPLIED (Logic Gap?)");
    }

    // 2. REPLICATE FILTER LOGIC
    if (filters.roleFilter && filters.roleFilter !== 'all') {
        console.log(`   -> Adding Role Filter: ${filters.roleFilter}`);
        const dbRole = filters.roleFilter === 'lider' ? 'leader' : filters.roleFilter;
        query = query.where(`roles.${dbRole}`, "==", true);
    }

    // 3. EXECUTE
    try {
        const snapshot = await query.limit(filters.limit).get();
        console.log(`\n✅ Query returned ${snapshot.size} docs.`);

        if (snapshot.size > 0) {
            console.log("First doc:", snapshot.docs[0].id, snapshot.docs[0].data().displayName);
        }
    } catch (e) {
        console.error("\n❌ QUERY FAILED:", e.message);
    }
}

debugController().then(() => process.exit());
