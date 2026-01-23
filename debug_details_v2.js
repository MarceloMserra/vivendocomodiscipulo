const { admin, db } = require('./src/config/firebase');

async function checkDetails() {
    console.log("🔍 Deep Dive...");

    // 1. Inspect PGM Arthur (Old)
    const oldPgm = await db.collection('pgms').doc('Vu2XaFHC5LC2SvDRBoSF').get();
    console.log("OLD PGM:", oldPgm.exists ? oldPgm.data() : "Not Found");

    // 2. Inspect PGM do Arthur (New)
    const newPgm = await db.collection('pgms').doc('ZKlkGv555WP4WuDZXIsU').get();
    console.log("NEW PGM:", newPgm.exists ? newPgm.data() : "Not Found");

    // 3. Find Arthurs
    const arthurs = await db.collection('users').where('email', '>=', 'arthur').where('email', '<=', 'arthur\uff88').get();
    console.log(`\nFound ${arthurs.size} Arthurs by email range:`);
    arthurs.forEach(d => console.log(`[USER] ${d.data().name} (${d.id}) - Leader: ${d.data().roles?.leader}`));

    // 4. Find Brunos
    const brunos = await db.collection('users').get(); // Get all to filter locally to be sure
    console.log("\nBrunos:");
    brunos.forEach(d => {
        const data = d.data();
        if ((data.name || '').includes("Bruno") || (data.displayName || '').includes("Bruno")) {
            console.log(`[USER] ${data.name} (${d.id}) - Roles: ${JSON.stringify(data.roles)} | LeaderUID: ${data.leaderUid}`);
        }
    });
}
checkDetails();
