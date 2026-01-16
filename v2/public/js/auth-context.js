import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCTB6wkVIfnwx009A67bv8Ar58YpD-59Z8",
    authDomain: "vivendo-como-discipulo.firebaseapp.com",
    projectId: "vivendo-como-discipulo",
    storageBucket: "vivendo-como-discipulo.firebasestorage.app",
    messagingSenderId: "1086407430526",
    appId: "1:1086407430526:web:d57784df6283c51729a32f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    const publicPaths = ['/login', '/register'];

    if (user) {
        // Logged In
        console.log("Auth: Logged In as", user.email);

        // redirect if on login/register
        if (publicPaths.includes(currentPath)) {
            window.location.href = '/';
            return;
        }

        // Fetch User Data for UI
        try {
            // Note: We could cache this in localStorage to avoid flashes
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                // Update UI elements if they exist
                const profileImg = document.querySelector('header img');
                if (profileImg) profileImg.src = `https://ui-avatars.com/api/?name=${data.name}&background=0F172A&color=fff`;
            }
        } catch (e) { console.error(e); }

    } else {
        // Not Logged In
        console.log("Auth: Not Logged In");
        if (!publicPaths.includes(currentPath)) {
            window.location.href = '/login';
        }
    }
});

// Expose logout globally
window.logout = () => signOut(auth).then(() => window.location.href = '/login');
