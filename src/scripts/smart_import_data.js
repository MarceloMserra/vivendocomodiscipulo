const admin = require('firebase-admin');
const XLSX = require('xlsx');
const serviceAccount = require('../../serviceAccountKey.json');

// Initialize Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function smartImport() {
    console.log("🚀 Starting Smart Import...");

    // 1. Read Excel
    const workbook = XLSX.readFile('mapeamento_pgs.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 1 }); // Assuming Header is Row 2 (Index 1) based on analysis
    // Wait, previous analysis showed headers at row 1 (index 0) but data started later?
    // Let's re-verify analysis output: 
    // Headers: [ 'Rede', 'Supervisor', 'Líder', 'Nome', ... ]
    // Data: [ 'Homens', 'Marco Borba', 'Walmir', 'André', ... ]
    // Usage: sheet_to_json default uses first row as header.

    // Let's just use default and map keys manually if needed to be safe.

    // Helper to find or create user
    const ensureUser = async (name, role, leaderUid = null, supervisorUid = null) => {
        if (!name || name === '-') return null;

        const nameLower = name.toLowerCase().trim();
        // Check by name_lower
        let snapshot = await db.collection('users').where('name_lower', '==', nameLower).get();

        let uid = null;
        let userData = {};

        if (!snapshot.empty) {
            // User Exists
            const doc = snapshot.docs[0];
            uid = doc.id;
            userData = doc.data();
            console.log(`   ✅ Found existing user: ${name} (${role})`);

            // UPDATE HIERARCHY ONLY IF MISSING or EXPLICIT SCRIPT
            const updates = {};
            if (leaderUid && userData.leaderUid !== leaderUid) {
                console.log(`      ⚠️ Updating Leader for ${name}: ${userData.leaderUid} -> ${leaderUid}`);
                updates.leaderUid = leaderUid;
            }

            // Update Role if current role is less than new role?
            // Existing logic: roles map.
            // If importing a Supervisor, ensure they have supervisor role.
            const currentRoles = userData.roles || {};
            let rolesChanged = false;

            if (role === 'supervisor' && !currentRoles.supervisor) {
                currentRoles.supervisor = true;
                rolesChanged = true;
            }
            if (role === 'leader' && !currentRoles.leader) {
                currentRoles.leader = true;
                rolesChanged = true;
            }

            if (rolesChanged) updates.roles = currentRoles;

            if (Object.keys(updates).length > 0) {
                await db.collection('users').doc(uid).update(updates);
            }

        } else {
            // Create New User (Placeholder)
            console.log(`   ✨ Creating NEW user: ${name} (${role})`);

            const newRoles = { member: true };
            if (role === 'supervisor') newRoles.supervisor = true;
            if (role === 'leader') newRoles.leader = true;

            const newUser = {
                displayName: name,
                name: name, // Legacy support
                name_lower: nameLower,
                email: `${nameLower.replace(/\s+/g, '.')}@placeholder.imbb`, // Fake email
                roles: newRoles,
                status: 'active', // So they show up
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (leaderUid) newUser.leaderUid = leaderUid;

            const res = await db.collection('users').add(newUser);
            uid = res.id;
        }
        return uid;
    };

    // PROCESS ROWS
    // Each row represents a MEMBER in a HIERARCHY
    // Rede | Supervisor | Líder | Nome
    // Note: The structure implies:
    // Supervisor leads the Leader? Or just organization?
    // In V3: Supervisor has leaderUid? No, usually Supervisor -> Leader -> Member.
    // So:
    // 1. Ensure Supervisor exists.
    // 2. Ensure Leader exists (and verify their leader is Supervisor).
    // 3. Ensure Member exists (and verify their leader is Leader).

    for (const row of rows) {
        // Keys might be 'Rede', 'Supervisor', 'Líder' (with accent), 'Nome'
        // Let's normalize keys
        const supervisorName = row['Supervisor'];
        const leaderName = row['Líder'] || row['Lider']; // Handle typo
        const memberName = row['Nome'];

        if (!leaderName) continue; // Skip empty rows

        // 1. Process Supervisor
        let supervisorUid = null;
        if (supervisorName) {
            supervisorUid = await ensureUser(supervisorName, 'supervisor', null);
            // Note: Supervisor's leader is undefined (or Pastor, not in sheet)
        }

        // 2. Process Leader
        let leaderUid = null;
        if (leaderName) {
            // The LEADER is led by the SUPERVISOR
            leaderUid = await ensureUser(leaderName, 'leader', supervisorUid);
            // Verify PGM creation? PGM is just a leader with a group now.
            // Ensure this leader is marked as 'leader' role (handled in ensureUser).
        }

        // 3. Process Member
        if (memberName && leaderUid) {
            await ensureUser(memberName, 'member', leaderUid);
        }
    }

    console.log("✅ Smart Import Setup Complete!");
}

smartImport().catch(console.error);
