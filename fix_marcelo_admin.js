const { db } = require('./src/config/firebase');

async function fixMarcelo() {
    console.log("Fetching all users to find 'Marcelo'...");

    // Fetch all users (small dataset assumption)
    const snapshot = await db.collection('users').get();

    const targetUser = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.displayName && data.displayName.includes("Marcelo");
    });

    if (!targetUser) {
        console.error("❌ User containing 'Marcelo' not found!");
        return;
    }

    const userData = targetUser.data();
    console.log(`✅ Found User: ${userData.displayName} (UID: ${targetUser.id})`);
    console.log("Current Roles:", userData.roles);

    // Grant Admin Role
    console.log("Granting Admin Role...");
    await targetUser.ref.update({
        'roles.admin': true,
        'roles.member': true
    });

    console.log("✅ Roles updated successfully.");

    // Verify
    const updated = await targetUser.ref.get();
    console.log("New Roles:", updated.data().roles);
}

fixMarcelo().then(() => process.exit());
