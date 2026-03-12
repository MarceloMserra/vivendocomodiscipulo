const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { verifyToken, requireAuth } = require('../middleware/authMiddleware');



// 1. View Route (Unprotected - Shell Only)
// Client side handles auth check via Firebase
router.get('/', meetingController.getMonitoringPage);
router.get('/reports', meetingController.getReportsPage);

// 2. API Routes (Protected)
// Client must send Bearer Token
router.post('/api/data', verifyToken, requireAuth, meetingController.getMonitoringData);
router.post('/save', verifyToken, requireAuth, meetingController.saveMeeting);
router.get('/export', verifyToken, requireAuth, meetingController.exportMeetings);

module.exports = router;
