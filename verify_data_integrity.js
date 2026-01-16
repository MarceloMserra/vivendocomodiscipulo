const { db } = require('./src/config/firebase');
const User = require('./src/models/User');
const PGMService = require('./src/services/PGMService');

async function verifyIntegrity() {
    console.log("--- DATA INTEGRITY CHECK ---");

    // 1. Count Raw Users
    const usersSnap = await db.collection('users').get();
    const allUsers = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id }));

    const rawCounts = {
        admins: allUsers.filter(u => u.roles && u.roles.admin).length,
        supervisors: allUsers.filter(u => u.roles && u.roles.supervisor).length,
        leaders: allUsers.filter(u => u.roles && u.roles.leader).length,
        members: allUsers.filter(u => u.roles && u.roles.member && !u.roles.leader && !u.roles.supervisor).length
    };

    console.log("RAW DB COUNTS (Users Collection):");
    console.log(rawCounts);

    // 2. Count via PGM Service logic (Simulation)
    console.log("\n--- TREE LOGIC SIMULATION ---");
    // Get Admin UID (Marcelo)
    const admin = allUsers.find(u => u.roles && u.roles.admin);
    if (!admin) { console.error("No Admin found!"); return; }

    console.log(`Simulating Tree for Admin: ${admin.displayName} (${admin.uid})`);

    try {
        const tree = await PGMService.getNetworkTree(admin.uid);

        function countNodes(node) {
            let counts = { supervisors: 0, leaders: 0, members: 0 };
            if (!node || !node.children) return counts;

            node.children.forEach(c => {
                const role = c.role.toLowerCase();
                if (role.includes('supervisor')) counts.supervisors++;
                if (role.includes('lider') || role.includes('líder')) counts.leaders++;
                if (role.includes('membro')) counts.members++;

                const sub = countNodes(c);
                counts.supervisors += sub.supervisors;
                counts.leaders += sub.leaders;
                counts.members += sub.members;
            });
            return counts;
        }

        const treeCounts = countNodes(tree);
        console.log("TREE RENDERED COUNTS:");
        console.log(treeCounts);

        console.log("\n--- DISCREPANCIES ---");
        console.log(`Supervisors: Raw ${rawCounts.supervisors} vs Tree ${treeCounts.supervisors}`);
        console.log(`Leaders:     Raw ${rawCounts.leaders}     vs Tree ${treeCounts.leaders}`);
        console.log(`Members:     Raw ${rawCounts.members}     vs Tree ${treeCounts.members}`);

    } catch (e) {
        console.error("Tree Error:", e);
    }
}

verifyIntegrity().then(() => process.exit());
