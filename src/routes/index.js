const express = require('express');
const router = express.Router();
const { uploadImage, uploadPDF } = require('../config/upload');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Controllers
const homeController = require('../controllers/homeController');
const userController = require('../controllers/userController');
const pgmController = require('../controllers/pgmController');
const adminController = require('../controllers/adminController');
const contentController = require('../controllers/contentController');
const managementController = require('../controllers/managementController');
const checkinController = require('../controllers/checkinController');
const prayerController = require('../controllers/prayerController');

// --- Routes ---

// 1. Páginas públicas (não exigem login)
router.get('/login', homeController.getLoginPage);
router.get('/register', homeController.getRegisterPage);

// 2. Páginas e APIs protegidas (exigem login)
router.get('/', requireAuth, homeController.getHomePage);
router.get('/profile', requireAuth, homeController.getProfilePage);
router.get('/admin', requireAuth, requireRole('admin'), adminController.getAdminPage);
router.get('/pgm', requireAuth, pgmController.getPgmPage);
router.get('/gestao', requireAuth, requireRole('supervisor'), managementController.getManagementPage);

// 2.1 API - Management (supervisor/admin only)
router.post('/api/gestao/stats', requireAuth, requireRole('supervisor'), managementController.getDashboardStats);
router.post('/api/gestao/users', requireAuth, requireRole('supervisor'), managementController.getUsersPaginated);
router.post('/api/gestao/update', requireAuth, requireRole('supervisor'), managementController.updateUser);
router.post('/api/gestao/groups', requireAuth, requireRole('supervisor'), managementController.getGroupsList);

// 3. API - User Profile
router.post('/api/profile/update', requireAuth, uploadImage.single("photo"), userController.updateProfile);
router.post('/api/profile/upload-photo', requireAuth, userController.uploadPhoto);
router.post('/api/user-data', requireAuth, userController.getUserData);

// 4. API - PGM
router.post('/api/my-pgm', requireAuth, pgmController.getMyPgm);
router.post('/pgm/add', requireAuth, pgmController.addMember);
router.post('/pgm/remove', requireAuth, pgmController.removeMember);
router.post('/pgm/post', requireAuth, pgmController.addPost);
router.post('/pgm/delete-post', requireAuth, pgmController.deletePost);
router.post('/pgm/event/add', requireAuth, pgmController.addEvent);
router.post('/pgm/event/delete', requireAuth, pgmController.deleteEvent);
router.post('/api/pgm/request', requireAuth, pgmController.requestEntry);
router.post('/api/supervisor/data', requireAuth, requireRole('supervisor'), pgmController.getSupervisorData);
router.post('/api/supervisor/metrics', requireAuth, requireRole('supervisor'), pgmController.getSupervisorMetrics);
router.post('/api/supervisor/group-details', requireAuth, requireRole('supervisor'), pgmController.getGroupDetails);
router.get('/rede/mapa', requireAuth, requireRole('supervisor'), pgmController.getNetworkMapPage);
router.post('/api/rede/tree', requireAuth, requireRole('supervisor'), pgmController.getNetworkTreeAPI);
router.post('/api/supervisor/assign', requireAuth, requireRole('supervisor'), pgmController.assignMember);
router.post('/api/supervisor/reject', requireAuth, requireRole('supervisor'), pgmController.rejectRequest);
router.post('/api/supervisor/promote', requireAuth, requireRole('admin'), pgmController.promoteToLeader);
router.post('/api/supervisor/demote', requireAuth, requireRole('admin'), pgmController.demoteLeader);

// 4.1 PGM Reports (líderes+)
router.get('/pgm/report', requireAuth, requireRole('lider'), pgmController.getReportPage);
router.post('/pgm/report/submit', requireAuth, requireRole('lider'), pgmController.submitReport);
router.get('/pgm/gallery', requireAuth, pgmController.getGalleryPage);
router.post('/api/pgm/gallery-data', requireAuth, pgmController.getGalleryData);

// 5. API - Comments
router.post('/comentar', requireAuth, homeController.postComment);
router.post('/comentario/delete', requireAuth, homeController.deleteComment);

// 6. API - Admin (admin only)
router.post('/api/admin/users', requireAuth, requireRole('admin'), adminController.getUsers);
router.post('/api/admin/update-role', requireAuth, requireRole('admin'), adminController.updateRole);

// 7. Upload PDF (admin only)
router.post('/upload-pdf', requireAuth, requireRole('admin'), uploadPDF.single("boletim"), contentController.uploadPdf);

// 8. QR Check-in
router.get('/checkin', requireAuth, checkinController.getCheckinPage);
router.get('/checkin/scan', checkinController.getCheckinScanPage); // Public - Firebase auth on client
router.post('/api/checkin/start', requireAuth, checkinController.startSession);
router.post('/api/checkin/confirm', requireAuth, checkinController.confirmPresence);
router.post('/api/checkin/close', requireAuth, checkinController.closeSession);
router.post('/api/checkin/status', requireAuth, checkinController.getSessionStatus);

// 9. Pedidos de Oração
router.get('/oracao', requireAuth, prayerController.getPrayersPage);
router.post('/api/oracao/list', requireAuth, prayerController.listPrayers);
router.post('/api/oracao/add', requireAuth, prayerController.addPrayer);
router.post('/api/oracao/pray', requireAuth, prayerController.prayForRequest);
router.post('/api/oracao/answer', requireAuth, prayerController.markAnswered);
router.post('/api/oracao/delete', requireAuth, prayerController.deletePrayer);

module.exports = router;
