const { db } = require('./src/config/firebase');

async function fixDataHeuristics() {
    console.log("--- FIXING DATA BASED ON EMAIL HEURISTICS ---");

    const snapshot = await db.collection('users').get();

    let updates = 0;

    for (const doc of snapshot.docs) {
        const u = doc.data();
        const email = u.email || "";
        let newRoles = u.roles || {};
        let changed = false;

        // HEURISTICS
        if (email.startsWith('lider') && !newRoles.leader) {
            newRoles.leader = true;
            newRoles.member = true;
            changed = true;
            console.log(`   + Promoting ${email} to LEADER`);
        }
        else if (email.startsWith('sup') && !newRoles.supervisor) {
            newRoles.supervisor = true;
            newRoles.member = true;
            changed = true;
            console.log(`   + Promoting ${email} to SUPERVISOR`);
        }
        else if (email.startsWith('membro') && !newRoles.member) {
            newRoles.member = true;
            changed = true;
            console.log(`   + Fixing role for ${email}`);
        }

        if (changed) {
            await doc.ref.update({ roles: newRoles });
            updates++;
        }
    }

    console.log(`\n✅ Updated ${updates} users.`);
}

fixDataHeuristics().then(() => process.exit());
