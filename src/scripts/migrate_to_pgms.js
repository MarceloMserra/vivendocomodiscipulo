const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { db, admin } = require('../config/firebase');

async function migrateToPGMs() {
    try {
        console.log("--- MIGRATING TO PGM MODEL ---");

        // 0. WIPE Existing PGMs
        console.log("Wiping existing PGMs...");
        const pgmsSnap = await db.collection('pgms').get();
        const batchDelete = db.batch();
        pgmsSnap.forEach(doc => batchDelete.delete(doc.ref));
        await batchDelete.commit();
        console.log(`Deleted ${pgmsSnap.size} existing PGMs.`);

        // 1. Load Mappings
        console.log("Loading Users...");
        const usersSnap = await db.collection('users').get();
        const usersMap = {}; // name_lower -> uid
        const uidToName = {}; // uid -> name
        usersSnap.forEach(doc => {
            const d = doc.data();
            if (d.name_lower) usersMap[d.name_lower] = doc.id;
            usersMap[d.displayName.toLowerCase()] = doc.id;
            uidToName[doc.id] = d.displayName;
        });

        // 2. Read Excel for PGM Structure
        const filePath = path.join(__dirname, '../../mapeamento_pgs.xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        // Group by Leaders to create distinct PGMs
        // Key: LeaderName (Raw Excel) -> { supervisor, network, size }
        const pgmDefinitions = new Map();

        data.forEach(row => {
            const leaderRaw = row['Líder'];
            if (!leaderRaw) return;
            if (!pgmDefinitions.has(leaderRaw)) {
                pgmDefinitions.set(leaderRaw, {
                    supervisor: row['Supevisão'],
                    network: row['Rede']
                });
            }
        });

        console.log(`Identified ${pgmDefinitions.size} Unique PGMs from Excel.`);

        // 3. Create PGMs
        let pgmCount = 0;
        const leaderUidToPgmId = {}; // uid -> pgmId (For meeting migration)

        for (const [leaderRaw, info] of pgmDefinitions) {
            // Find Leader UIDs
            const parts = leaderRaw.replace(/Pr\./g, '').trim().split(/ e | E |,/).map(s => s.trim()).filter(s => s.length > 1);
            const leaderUids = [];

            for (const p of parts) {
                const key = p.toLowerCase();
                // Try sanitize like provision script if direct match fails
                if (usersMap[key]) {
                    leaderUids.push(usersMap[key]);
                } else {
                    // Try slug approach just in case our map key is different
                    // "Luiz Antonio" -> luiz.antonio logic? 
                    // usersMap should cover it if we saved name_lower correctly.
                }
            }

            if (leaderUids.length === 0) {
                console.warn(`[SKIP] No users found for PGM '${leaderRaw}'`);
                continue;
            }

            // Find Supervisor UID
            let supervisorUid = null;
            if (info.supervisor) {
                const supParts = info.supervisor.replace(/Pr\./g, '').trim().split(/ e | E |,/).map(s => s.trim());
                if (supParts.length > 0 && usersMap[supParts[0].toLowerCase()]) {
                    supervisorUid = usersMap[supParts[0].toLowerCase()];
                }
            }

            // Create PGM Doc
            const pgmRef = db.collection('pgms').doc();
            await pgmRef.set({
                name: `PGM ${leaderRaw}`, // "PGM Luiz e Ronilda"
                leaderUids: leaderUids,
                supervisorUid: supervisorUid,
                supervisorName: info.supervisor,
                network: info.network || 'Geral',
                active: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update Users with pgmId
            for (const uid of leaderUids) {
                await db.collection('users').doc(uid).update({ pgmId: pgmRef.id });
                leaderUidToPgmId[uid] = pgmRef.id;
            }

            console.log(`Created: ${pgmRef.id} -> ${leaderRaw} (Leaders: ${leaderUids.length})`);
            pgmCount++;
        }

        // 4. Migrate Meetings
        console.log("\n--- MIGRATING MEETINGS ---");
        const meetingsSnap = await db.collection('meetings').get();
        let updatedMeetings = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of meetingsSnap.docs) {
            const m = doc.data();
            const leaderUid = m.leaderUid;

            // Look up PGM ID
            // If leaderUid is one of the leaders we mapped, we use that PGM ID.
            const pgmId = leaderUidToPgmId[leaderUid];

            if (pgmId) {
                batch.update(doc.ref, { pgmId: pgmId });
                updatedMeetings++;
                batchCount++;
            } else {
                console.warn(`[WARN] Meeting ${doc.id} (Leader: ${uidToName[leaderUid]}) has no PGM mapping.`);
            }

            if (batchCount >= 400) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) await batch.commit();

        console.log(`\n✅ Migration Complete.`);
        console.log(`PGMs Created: ${pgmCount}`);
        console.log(`Meetings Updated: ${updatedMeetings}`);

    } catch (e) {
        console.error("FATAL:", e);
    }
}

migrateToPGMs();
