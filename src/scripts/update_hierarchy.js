const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { db } = require('../config/firebase'); // Adjust path as needed

async function updateHierarchy() {
    try {
        console.log("--- STARTING HIERARCHY UPDATE ---");

        // 1. Read Excel
        const filePath = path.join(__dirname, '../../mapeamento_pgs.xlsx');
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet); // Array of objects

        console.log(`Loaded ${data.length} rows from Excel.`);

        // 2. Load all Users into Memory for fast lookup
        console.log("Fetching all users from Firestore...");
        const usersSnap = await db.collection('users').get();
        const usersMap = {}; // name_lower -> { uid, name, roles }

        usersSnap.forEach(doc => {
            const d = doc.data();
            const name = d.displayName || d.name || '';
            if (name) {
                const lower = name.toLowerCase().trim();
                usersMap[lower] = { uid: doc.id, name, roles: d.roles || {} };
                // Also map d.name_lower if it exists and is different
                if (d.name_lower && d.name_lower !== lower) {
                    usersMap[d.name_lower] = { uid: doc.id, name, roles: d.roles || {} };
                }
            }
        });
        console.log(`Mapped ${Object.keys(usersMap).length} user names.`);

        // 3. Process Hierarchy
        let updatesCount = 0;
        let errorsCount = 0;
        const processedLeaders = new Set(); // To avoid duplicate updates for same leader

        for (const row of data) {
            const leaderName = row['Líder'];
            const supervisorName = row['Supevisão']; // Note: ensure column name matches exactly what read_excel showed

            if (!leaderName || !supervisorName) continue;

            const leaderKey = leaderName.toLowerCase().trim();
            const supervisorKey = supervisorName.toLowerCase().trim();

            if (processedLeaders.has(leaderKey)) continue; // Already processed this leader

            const leaderUser = usersMap[leaderKey];
            const supervisorUser = usersMap[supervisorKey];

            if (leaderUser && supervisorUser) {
                // Perform Update
                if (leaderUser.uid === supervisorUser.uid) {
                    console.log(`[SKIP] Leader ${leaderUser.name} is their own supervisor? Skipping.`);
                    continue;
                }

                // Check if update is needed
                // We'll update regardless to be sure, or we could check existing leaderUid if we fetched it.
                // Since our map structure didn't store leaderUid, let's just update.

                await db.collection('users').doc(leaderUser.uid).update({
                    leaderUid: supervisorUser.uid
                });
                console.log(`[OK] Linked '${leaderUser.name}' -> Supervisor '${supervisorUser.name}'`);
                updatesCount++;
                processedLeaders.add(leaderKey);

            } else {
                if (!leaderUser) console.warn(`[MISSING] Leader not found in DB: '${leaderName}'`);
                if (!supervisorUser) console.warn(`[MISSING] Supervisor not found in DB: '${supervisorName}' (Leader: ${leaderName})`);
                errorsCount++;
            }
        }

        console.log("\n--- SUMMARY ---");
        console.log(`Updates: ${updatesCount}`);
        console.log(`Errors/Missing: ${errorsCount}`);
        console.log("Done.");

    } catch (e) {
        console.error("Fatal Error:", e);
    }
}

// Execute
updateHierarchy();
