const PGMService = require('./src/services/PGMService');
const { db } = require('./src/config/firebase');

async function testTree() {
    console.log("--- VERIFYING TREE GENERATION ---");
    // ID do Supervisor Carlos (que estava dando erro)
    const rootUid = "ur9GjTD5yAgf29FuUpvnWvQZYEh1";

    try {
        const tree = await PGMService.getNetworkTree(rootUid);
        console.log("TREE RESULT:");
        console.log(JSON.stringify(tree, null, 2));

        if (tree.children && tree.children.length > 0) {
            console.log("✅ SUCCESS: Tree has children!");
        } else {
            console.log("❌ FAILURE: Tree is still empty (root only).");
        }
    } catch (e) {
        console.error("ERROR:", e);
    }
}

testTree().then(() => process.exit());
