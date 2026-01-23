const { admin, db } = require('./src/config/firebase');

async function verify() {
    console.log("🕵️ Verifying Fix...");

    // 1. Check Arthur
    const arthur = await db.collection('users').doc('gbDQgqS4iih2ZQPB4awCI2xTglJ2').get(); // Real Arthur
    console.log(`Arthur (Real): ${arthur.exists ? '✅ Found' : '❌ MISSING'} | Roles: ${JSON.stringify(arthur.data().roles)}`);

    // 2. Check PGM
    const pgm = await db.collection('pgms').doc('Vu2XaFHC5LC2SvDRBoSF').get(); // Real PGM
    console.log(`PGM (Real): ${pgm.exists ? '✅ Found' : '❌ MISSING'} | Leader: ${pgm.data().leaderUid}`);

    // 3. Check Members
    const membersToCheck = ["Bruno", "Raphael", "Phelipe", "Marcelo Serra"];
    for (const name of membersToCheck) {
        // Search by strict name or display name
        const snap = await db.collection('users').where('displayName', '==', name).get();
        if (snap.empty) {
            // Try strict 'name'
            const snap2 = await db.collection('users').where('name', '==', name).get();
            if (snap2.empty) console.log(`❌ Member '${name}' NOT FOUND`);
            else printMember(snap2.docs[0]);
        } else {
            printMember(snap.docs[0]);
        }
    }
}

function printMember(doc) {
    const d = doc.data();
    console.log(`✅ Member: ${d.displayName || d.name} | Role: ${d.role} | Roles: ${JSON.stringify(d.roles)} | Leader: ${d.leaderUid} (${d.leaderUid === 'gbDQgqS4iih2ZQPB4awCI2xTglJ2' ? '✅ Correct' : '❌ WRONG'})`);
}

verify();
