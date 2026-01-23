const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { db } = require('../config/firebase');

async function debugNames() {
    try {
        console.log("--- DEBUG NAMES ---");

        // 1. Read Excel Names
        const filePath = path.join(__dirname, '../../mapeamento_pgs.xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        const excelLeaders = new Set();
        data.forEach(row => {
            if (row['Líder']) excelLeaders.add(row['Líder']);
        });

        console.log(`\nCreates ${excelLeaders.size} unique Leader names from Excel.`);
        console.log("First 10 Excel Leaders:", Array.from(excelLeaders).slice(0, 10));

        // 2. Read DB Names
        const usersSnap = await db.collection('users').get(); // .where('role.lider', '==', true) might be better but let's see all
        const dbNames = [];
        usersSnap.forEach(doc => {
            const d = doc.data();
            dbNames.push(d.displayName || d.name || 'No Name');
        });

        console.log(`\nFound ${dbNames.length} users in DB.`);
        console.log("First 10 DB Names:", dbNames.slice(0, 10));

        // 3. Simple Check
        console.log("\n--- DIRECT MATCH CHECK ---");
        let matches = 0;
        excelLeaders.forEach(exName => {
            const lower = exName.toLowerCase().trim();
            const found = dbNames.find(dbName => dbName.toLowerCase().trim() === lower);
            if (found) {
                // console.log(`[MATCH] '${exName}' matches '${found}'`);
                matches++;
            } else {
                // console.log(`[NO MATCH] '${exName}'`);
            }
        });
        console.log(`Total Matches: ${matches} / ${excelLeaders.size}`);

    } catch (e) {
        console.error(e);
    }
}

debugNames();
