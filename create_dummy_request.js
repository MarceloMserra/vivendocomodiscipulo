const { db, admin } = require('./src/config/firebase');

async function createRequest() {
    console.log("--- CREATING DUMMY REQUEST FOR RAPHAEL ---");
    try {
        // Find Raphael
        const snap = await db.collection("users").where("displayName", ">=", "Raphael").limit(1).get();
        if (snap.empty) {
            console.log("Raphael not found.");
            process.exit();
        }

        const user = snap.docs[0].data();
        const uid = snap.docs[0].id;
        console.log(`Found User: ${user.displayName} (${uid})`);

        // Create Request
        await db.collection("pgm_requests").add({
            uid: uid,
            name: user.displayName,
            whatsapp: "11999999999",
            requestedLeader: "Não informado",
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Request created successfully!");

    } catch (e) {
        console.error("Error creating request:", e.message);
    }
    process.exit();
}

createRequest();
