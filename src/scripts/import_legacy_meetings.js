const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { db, admin } = require('../config/firebase');

// Cache to look up Leader UIDs by Name
const usersCache = {}; // name_lower -> uid

async function importLegacy() {
    try {
        console.log("--- IMPORTING LEGACY MEETINGS (2024) ---");

        // 1. Load Leaders Cache
        console.log("Loading User Cache...");
        const usersSnap = await db.collection('users').get();
        usersSnap.forEach(doc => {
            const d = doc.data();
            if (d.name_lower) usersCache[d.name_lower] = doc.id;
            const displayNameLower = d.displayName.toLowerCase();
            usersCache[displayNameLower] = doc.id;
        });
        console.log(`Cached ${Object.keys(usersCache).length} name keys.`);

        // 2. Read Excel
        const filePath = path.join(__dirname, '../../mapeamento_pgs.xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        let createdCount = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (const row of data) {
            const leaderName = row['Líder'];
            if (!leaderName) continue;

            const participants = row['Número de Participantes'];
            if (!participants || participants === 0) continue; // Skip if 0/null

            // Determine Date
            let dateVal = row['Início Semana'] || row['Data da Reunião'];
            if (!dateVal) continue;

            let meetingDate;
            if (typeof dateVal === 'number') {
                // Excel Date (Days since 1900)
                meetingDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            } else {
                // Try parse string? Usually it's number in Excel JSON unless formatted
                // If it's "05/10 11/10", this logic might fail or just take today?
                // Verify sample data: 45935 -> integer.
                continue;
            }

            // Find Leader UID
            // Problem: Leader Name in Excel is "Luiz e Ronilda", but we split them into "Luiz" and "Ronilda".
            // Which one gets the meeting?
            // Convention: We link to the FIRST one found.

            const parts = leaderName.replace(/Pr\./g, '').trim().split(/ e | E |,/).map(s => s.trim()).filter(s => s.length > 1);
            let leaderUid = null;

            for (const p of parts) {
                const key = p.toLowerCase();
                if (usersCache[key]) {
                    leaderUid = usersCache[key];
                    break;
                }
            }

            if (!leaderUid) {
                console.warn(`[SKIP] Leader not found for '${leaderName}'`);
                continue;
            }

            // Create Meeting Doc
            const ref = db.collection('meetings').doc();
            batch.set(ref, {
                leaderUid: leaderUid,
                date: admin.firestore.Timestamp.fromDate(meetingDate),
                legacyMemberCount: parseInt(participants),
                attendees: [],
                visitorCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                imported: true
            });

            batchCount++;
            createdCount++;

            if (batchCount >= 400) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
                process.stdout.write('.');
            }
        }

        if (batchCount > 0) await batch.commit();
        console.log(`\n✅ Imported ${createdCount} legacy meetings.`);

    } catch (e) {
        console.error("Fatal Error:", e);
    }
}

importLegacy();
