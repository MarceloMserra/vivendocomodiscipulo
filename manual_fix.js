const { db } = require('./src/config/firebase');

async function manualFix() {
    // "Líder Sem Nome" (oIjqVflgkafjzrBiDeDLCj9EFDr2) was missing supervisor in group
    // Assign him to "Supervisor Carlos" (ur9GjTD5yAgf29FuUpvnWvQZYEh1)

    console.log("Linking Orphan Leader to Supervisor...");
    await db.collection('users').doc("oIjqVflgkafjzrBiDeDLCj9EFDr2").update({
        leaderUid: "ur9GjTD5yAgf29FuUpvnWvQZYEh1"
    });
    console.log("✅ Fixed.");
}

manualFix().then(() => process.exit());
