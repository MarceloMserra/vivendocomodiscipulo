const { admin, db } = require('./src/config/firebase');

async function debugDupes() {
    console.log("🔍 Checking for duplicates...");

    const checkNames = ["Arthur", "Bruno", "Raphael", "Rafael", "Phelipe", "Marcelo"];

    // 1. Check Users
    console.log("\n--- USERS ---");
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach(doc => {
        const d = doc.data();
        const lowerName = (d.displayName || d.name || '').toLowerCase();

        if (checkNames.some(n => lowerName.includes(n.toLowerCase()))) {
            console.log(`[USER] ${d.name || d.displayName} | UID: ${doc.id} | Role: ${JSON.stringify(d.roles)} | LeaderID: ${d.leaderUid} | PGM: ${d.pgmId}`);
        }
    });

    // 2. Check PGMs
    console.log("\n--- PGMS ---");
    const pgmSnap = await db.collection("pgms").get();
    pgmSnap.forEach(doc => {
        const d = doc.data();
        if (d.name.includes("Arthur") || d.leaderUid) {
            console.log(`[PGM] ${d.name} | ID: ${doc.id} | LeaderUID: ${d.leaderUid}`);
        }
    });
}

debugDupes();
