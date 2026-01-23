const { admin, db } = require('./src/config/firebase');

async function seedTeam() {
    console.log("🌱 Semeando time do Arthur...");

    try {
        // 1. Create Leader: Arthur
        // Uses a fixed UID so we don't duplicate him if we run this again (optional, but good practice)
        // For simplicity, we'll let it create a new one as requested "criar alguns membros... vinculados a um lider Arthur"

        const leaderData = {
            name: "Arthur Lider",
            email: "arthur@teste.com",
            role: "lider", // Legacy role string
            roles: { leader: true, member: true }, // V3 Roles
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const leaderRef = await db.collection('users').add(leaderData);
        const leaderUid = leaderRef.id;
        console.log(`✅ Lider Criado: Arthur (UID: ${leaderUid})`);

        // Update PGM Group for Arthur (V3 Model requires a PGM doc for the leader)
        const pgmRef = await db.collection('pgms').add({
            leaderUid: leaderUid,
            name: "PGM do Arthur",
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const pgmId = pgmRef.id;
        console.log(`✅ PGM do Arthur criada (ID: ${pgmId})`);

        // 2. Create Members
        // Updated names as per user request
        const members = ["Bruno", "Raphael", "Phelipe", "Marcelo Serra"];

        for (const name of members) {
            const memberData = {
                name: name,
                displayName: name, // Ensure consistency
                email: `${name.toLowerCase().replace(/\s/g, '')}@teste.com`,
                role: "membro", // Legacy
                roles: { member: true }, // V3
                leaderUid: leaderUid, // V3 Relationship
                pgmId: pgmId, // Legacy Relationship (Required for ManagementController V1)
                groupId: pgmId, // V3 Relationship
                active: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                photoUrl: null
            };

            const mRef = await db.collection('users').add(memberData);
            console.log(`   -> Membro Adicionado: ${name} (UID: ${mRef.id})`);
        }

        console.log("\n🎉 Processo Finalizado! Verifique o Mapa e a Gestão.");

    } catch (e) {
        console.error("❌ Erro ao semear:", e);
    }
}

seedTeam();
