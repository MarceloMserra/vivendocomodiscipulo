const { auth } = require("../config/firebase");

// Middleware to verify Firebase ID Token in HTTP Header
const verifyToken = async (req, res, next) => {
    // 1. Check for Authorization header
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: No token provided" }); // Or redirect to login if it's a page request
    }

    const token = header.split(' ')[1];

    try {
        // 2. Verify Token
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken; // Attach user info to request
        next();
    } catch (error) {
        console.error("Auth Error:", error);
        return res.status(403).json({ error: "Unauthorized: Invalid token" });
    }
};

module.exports = { verifyToken };
