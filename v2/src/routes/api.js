const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Placeholder for API routes
router.get('/test', (req, res) => res.json({ msg: "API Working" }));

// Example Protected Route
router.get('/secure-data', verifyToken, (req, res) => {
    res.json({ secret: "This is secured", user: req.user });
});

module.exports = router;
