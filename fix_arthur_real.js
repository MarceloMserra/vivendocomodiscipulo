const { admin, db } = require('./src/config/firebase');

const REAL_ARTHUR_UID = 'gbDQgqS4iih2ZQPB4awCI2xTglJ2';
const REAL_PGM_ID = 'Vu2XaFHC5LC2SvDRBoSF';

const FAKE_ARTHUR_UID = 'nSHGQDNYYKY0veq5yLLL'; // From my logs
const FAKE_PGM_ID = 'ZKlkGv555WP4WuDZXIsU'; // From my logs

// Names to process (Name to search -> Canonical Name)
// Note: We search flexibly
const MEMBERS_TO_FIX = [
    { search: "Bruno", canonical: "Bruno" },
    { search: "Raphael", alt: "Rafael", canonical: "Raphael" },
    { search: "Phelipe", canonical: "Phelipe" },
    { search: "Marcelo Serra", canonical: "Marcelo Serra" }
];

async function fixData() {
    console.log("🛠️ Fixing Arthur's Team Data...");

    try {
        // 1. Delete Fake Arthur & PGM
        console.log(`Deleting Fake Arthur (${FAKE_ARTHUR_UID}) and PGM...`);
        try {
            await db.collection('users').doc(FAKE_ARTHUR_UID).delete();
            await db.collection('pgms').doc(FAKE_PGM_ID).delete();
            console.log("✅ Deleted Fake Arthur & PGM.");
        } catch (e) {
            console.log("⚠️ Failed to delete fake data (maybe already gone):", e.message);
        }

        // 2. Process Members
        const usersSnap = await db.collection('users').get();
        const allUsers = [];
        usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

        for (const target of MEMBERS_TO_FIX) {
            console.log(`\nProcessing: ${target.canonical}...`);

            // Find matches
            const matches = allUsers.filter(u => {
                const name = (u.displayName || u.name || '').toLowerCase();
                const s1 = target.search.toLowerCase();
                const s2 = target.alt ? target.alt.toLowerCase() : "zzzzzz"; // dummy
                return name.includes(s1) || name.includes(s2);
            });

            if (matches.length === 0) {
                console.log(`❌ No user found for ${target.canonical}. Must create? No, I assume I created one already.`);
                continue;
            }

            // Sort: Real people usually have older accounts. My script created fresh ones today.
            // If there's a real account, it's likely older.
            // If both are today, we pick one randomly or the one with "Role: Lider" (to fix him).

            // We want to KEEP the "best" account.
            // Heuristic: Oldest creation time is best.
            matches.sort((a, b) => {
                const tA = a.createdAt ? a.createdAt.seconds : 9999999999;
                const tB = b.createdAt ? b.createdAt.seconds : 9999999999;
                return tA - tB;
            });

            const keeper = matches[0];
            const duplicates = matches.slice(1);

            console.log(`   Keeper: ${keeper.name} (ID: ${keeper.id}) [Created: ${keeper.createdAt ? keeper.createdAt.toDate() : '?'}]`);
            if (duplicates.length > 0) {
                console.log(`   Duplicates to DELETE: ${duplicates.map(d => d.id).join(', ')}`);
                for (const dup of duplicates) {
                    await db.collection('users').doc(dup.id).delete();
                    console.log(`      🗑️ Deleted ${dup.id}`);
                }
            }

            // 3. Update the Keeper
            // Force him to be a Member of Real Arthur
            const updates = {
                leaderUid: REAL_ARTHUR_UID,
                pgmId: REAL_PGM_ID,
                groupId: REAL_PGM_ID,
                role: 'membro',
                active: true,
                roles: { member: true, leader: false, supervisor: false, admin: false }, // Explicitly demote
                displayName: target.canonical // Fix name spelling if needed (Rafael -> Raphael)
            };

            await db.collection('users').doc(keeper.id).update(updates);
            console.log(`   ✅ Updated ${keeper.name} -> Member of Arthur (Real)`);
        }

        console.log("\n🎉 FIX COMPLETED.");

    } catch (e) {
        console.error("❌ Critical Error:", e);
    }
}

fixData();
