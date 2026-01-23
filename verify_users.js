const { db } = require('./src/config/firebase');

async function debugRecentUsers() {
    console.log("--- DEBUGGING RECENT USERS ---");
    try {
        // Fetch users created in the last 24 hours (if createdAt exists)
        // Or just list all users to see if we find the "new member"
        const snap = await db.collection("users").get();
        console.log(`Total Users: ${snap.size}`);

        const users = [];
        snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

        // Sort by some heuristic (maybe creation time isn't stored reliable?)
        // Let's just list names
        console.log("Users:", users.map(u => u.displayName || u.email).join(', '));

    } catch (e) {
        console.error("Error fetching users:", e.message);
    }
    process.exit();
}

debugRecentUsers();
