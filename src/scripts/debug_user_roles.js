const { db } = require('../config/firebase');

async function debugUser() {
    console.log("--- DUMPING ALL USERS (Limit 20) ---");
    const all = await db.collection('users').limit(20).get();
    all.forEach(doc => {
        const d = doc.data();
        console.log(`\nUID: ${doc.id}`);
        console.log(`Name: ${d.name} | DisplayName: ${d.displayName} | Email: ${d.email}`);
        console.log(`Roles:`, JSON.stringify(d.roles));
    });
}

debugUser().then(() => {
    console.log("Done.");
    process.exit();
}).catch(e => {
    console.error("FATAL:", e);
    process.exit(1);
});
