const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { db, admin } = require('../config/firebase');

const ADMIN_UID = 'nrfbUohhw1WWV9l5ZMXTHhK9mmC2'; // Marcelo
const DEFAULT_PASS = 'mudar123';

const createdUsers = new Map(); // name_clean -> { uid, email, role }
const csvRows = [['Nome Original', 'Nome Sistema', 'Email', 'Senha', 'Cargo', 'Supervisor']];

async function provisionUsers() {
    try {
        console.log("!!! STARTING PROVISIONING - DANGER ZONE !!!");

        // 1. WIPE DATA
        console.log("--- CLEANSING DATABASE ---");

        // Delete Meetings
        const meetingsSnap = await db.collection('meetings').get();
        const meetingBatch = db.batch();
        meetingsSnap.forEach(doc => meetingBatch.delete(doc.ref));
        await meetingBatch.commit();
        console.log(`Deleted ${meetingsSnap.size} meetings.`);

        // Delete Users (Except Admin)
        const usersSnap = await db.collection('users').get();
        const usersBatch = db.batch(); // Firestore batch limit is 500, unlikely to hit it yet, but careful
        let deletedCount = 0;

        // Also delete from Auth
        const listUsersResult = await admin.auth().listUsers(1000);
        for (const userRecord of listUsersResult.users) {
            if (userRecord.uid === ADMIN_UID) continue;
            try {
                await admin.auth().deleteUser(userRecord.uid);
                // process.stdout.write('.');
            } catch (e) {
                console.error(`Auth Delete Fail (${userRecord.email}):`, e.message);
            }
        }
        console.log("\nAuth users cleansed.");

        usersSnap.forEach(doc => {
            if (doc.id === ADMIN_UID) return;
            usersBatch.delete(doc.ref);
            deletedCount++;
        });
        await usersBatch.commit();
        console.log(`Deleted ${deletedCount} user docs (Preserved Admin).`);


        // 2. READ EXCEL
        const filePath = path.join(__dirname, '../../mapeamento_pgs.xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        console.log(`\nLoaded ${data.length} rows from Excel.`);

        // 3. PROCESS SUPERVISORS
        console.log("--- PROCESSING SUPERVISORS ---");
        const supervisorsMap = {}; // name -> uid

        for (const row of data) {
            const rawName = row['Supevisão'];
            if (!rawName) continue;

            // Handle pairs? "Luiz e Ronilda" -> Usually Supervisors are couples too.
            // Requirement: "Create user for each".
            // If Supervisor is a pair, who is the 'leaderUid' targeted? Usually checking frequency is singular.
            // Strategy: Create both, but map the *first* one as the references.

            const uids = await processPersonOrPair(rawName, 'supervisor');
            if (uids.length > 0) {
                supervisorsMap[rawName] = uids[0]; // Map Full String to Primary UID
            }
        }

        // 4. PROCESS LEADERS
        console.log("--- PROCESSING LEADERS ---");
        for (const row of data) {
            const leaderName = row['Líder'];
            const supervisorName = row['Supevisão'];

            if (!leaderName) continue;

            const supervisorUid = supervisorsMap[supervisorName];
            await processPersonOrPair(leaderName, 'leader', supervisorUid, supervisorName);
        }

        // 5. EXPORT CSV
        const csvContent = csvRows.map(r => r.join(',')).join('\n');
        fs.writeFileSync(path.join(__dirname, '../../acessos_gerados.csv'), csvContent);
        console.log("\n✅ Done! Credentials saved to 'acessos_gerados.csv'");

    } catch (e) {
        console.error("FATAL:", e);
    }
}

async function processPersonOrPair(rawName, role, supervisorUid = null, supervisorName = '') {
    // 1. Clean Name
    let clean = rawName.replace(/Pr\./g, '').trim(); // Remove Pr.
    clean = clean.replace(/\s+/g, ' '); // Fix spaces

    // 2. Split Pairs
    // Delimiters: " e ", " E ", ","
    const parts = clean.split(/ e | E |,/).map(s => s.trim()).filter(s => s.length > 1);

    const generatedUids = [];

    for (const part of parts) {
        const uid = await createAccount(part, role, supervisorUid, supervisorName, rawName);
        generatedUids.push(uid);
    }

    return generatedUids;
}

async function createAccount(name, role, supervisorUid, supervisorNameOriginal, originalNameGroup) {
    if (createdUsers.has(name.toLowerCase())) {
        return createdUsers.get(name.toLowerCase()).uid;
    }

    // Generate Email
    // "Luiz Antonio" -> luiz.antonio@pgm.com
    const slug = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]+/g, '.') // symbols to dot
        .replace(/^\.+|\.+$/g, ''); // Trim dots from start/end

    let email = `${slug}@pgm.com`;
    // Check duplicates? (In simple logic, assuming unique names for now, or Auth will fail)

    let uid;
    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: DEFAULT_PASS,
            displayName: name,
        });
        uid = userRecord.uid;
    } catch (e) {
        if (e.code === 'auth/email-already-exists') {
            // Fallback
            email = `${slug}.2@pgm.com`;
            const r = await admin.auth().createUser({ email, password: DEFAULT_PASS, displayName: name });
            uid = r.uid;
        } else {
            console.error(`Error creating ${name}:`, e.message);
            return null;
        }
    }

    // Role Object
    const roles = { member: true };
    if (role === 'supervisor') roles.supervisor = true;
    if (role === 'leader') roles.lider = true; // Note: 'lider' key in Firestore based on dossier

    // Create Doc
    const docData = {
        displayName: name,
        name_lower: name.toLowerCase(),
        email: email,
        roles: roles,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (supervisorUid) {
        docData.leaderUid = supervisorUid;
    }

    await db.collection('users').doc(uid).set(docData);

    createdUsers.set(name.toLowerCase(), { uid, email });
    csvRows.push([
        `"${originalNameGroup}"`, // Original Name (Group)
        `"${name}"`,            // Clean Name
        email,
        DEFAULT_PASS,
        role,
        `"${supervisorNameOriginal}"`
    ]);

    console.log(`Created: ${name} (${role}) -> ${email}`);
    return uid;
}

provisionUsers();
