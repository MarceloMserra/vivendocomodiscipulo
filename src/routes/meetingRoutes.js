const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { verifyToken, requireAuth, requireRole } = require('../middleware/authMiddleware');



// 1. View Routes (líderes+)
router.get('/', requireAuth, requireRole('lider'), meetingController.getMonitoringPage);
router.get('/reports', requireAuth, requireRole('lider'), meetingController.getReportsPage);

// 2. API Routes (Protected - líderes+)
router.post('/api/data', verifyToken, requireAuth, meetingController.getMonitoringData);
router.post('/save', verifyToken, requireAuth, requireRole('lider'), meetingController.saveMeeting);
router.get('/export', verifyToken, requireAuth, requireRole('supervisor'), meetingController.exportMeetings);

module.exports = router;
