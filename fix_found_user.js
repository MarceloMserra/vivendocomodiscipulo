const { db } = require('./src/config/firebase');

async function fixSpecificUser() {
    const targetUid = "nrfbUohhw1WWV9l5ZMXTHhK9mmC2"; // mmdigital001@gmail.com

    console.log(`Updating user ${targetUid}...`);

    await db.collection('users').doc(targetUid).update({
        displayName: "Marcelo Madureira Serra",
        roles: {
            admin: true,
            supervisor: true,
            member: true
        },
        updatedAt: new Date()
    });

    console.log("✅ User updated with ADMIN role.");
}

fixSpecificUser().then(() => process.exit());
