const { db } = require('../config/firebase');

async function auditUsers() {
    console.log("--- AUDIT USERS ---");
    const snap = await db.collection('users').get();

    let onlyMemberCount = 0;

    snap.forEach(doc => {
        const d = doc.data();
        const roles = d.roles || {};
        const isSupervisor = roles.supervisor;
        const isLeader = roles.lider;
        const isAdmin = roles.admin;

        // Check if "Just Member" (and not admin)
        if (!isSupervisor && !isLeader && !isAdmin) {
            console.log(`[ONLY MEMBER] ${d.displayName} (${d.email})`);
            onlyMemberCount++;
        } else {
            // verbose logging for verification
            // console.log(`[OK] ${d.displayName} - Sup:${!!isSupervisor} Lid:${!!isLeader} Adm:${!!isAdmin}`);
        }
    });

    console.log(`\nTotal Users: ${snap.size}`);
    console.log(`Users with ONLY 'member' role (Suspicious): ${onlyMemberCount}`);
}

auditUsers();
