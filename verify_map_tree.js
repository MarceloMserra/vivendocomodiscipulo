const PGMService = require('./src/services/PGMService');
const { db } = require('./src/config/firebase');

async function debugMapTree() {
    console.log("--- DEBUGGING MAP TREE (TITO) ---");
    // Find Tito
    const snap = await db.collection("users").where("email", "==", "tito@pgm.com").get();
    if (snap.empty) return console.log("Tito not found");
    const titoUid = snap.docs[0].id;
    console.log(`Supervisor UID: ${titoUid}`);

    try {
        const tree = await PGMService.getNetworkTreePGMBased(titoUid);
        console.log("Tree Root:", tree.name);
        if (tree.children) {
            tree.children.forEach(pgm => {
                console.log(`- PGM Node: ${pgm.name}`);
                if (pgm.children) {
                    pgm.children.forEach(member => {
                        console.log(`  -- Member: ${member.name}`);
                    });
                }
            });
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit();
}

debugMapTree();
