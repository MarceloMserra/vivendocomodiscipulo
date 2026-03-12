const express = require('express');
const router = express.Router();
const { uploadImage, uploadPDF } = require('../config/upload');
const { requireAuth } = require('../middleware/authMiddleware');

// Controllers
const homeController = require('../controllers/homeController');
const userController = require('../controllers/userController');
const pgmController = require('../controllers/pgmController');
const adminController = require('../controllers/adminController');
const contentController = require('../controllers/contentController');
const managementController = require('../controllers/managementController');

// --- Routes ---

// 1. Páginas públicas (não exigem login)
router.get('/login', homeController.getLoginPage);
router.get('/register', homeController.getRegisterPage);

// 2. Páginas e APIs protegidas (exigem login)
router.get('/', requireAuth, homeController.getHomePage);
router.get('/profile', requireAuth, homeController.getProfilePage);
router.get('/admin', requireAuth, adminController.getAdminPage);
router.get('/pgm', requireAuth, pgmController.getPgmPage);
router.get('/gestao', requireAuth, managementController.getManagementPage);

// 2.1 API - Management
router.post('/api/gestao/stats', requireAuth, managementController.getDashboardStats);
router.post('/api/gestao/users', requireAuth, managementController.getUsersPaginated);
router.post('/api/gestao/update', requireAuth, managementController.updateUser);
router.post('/api/gestao/groups', requireAuth, managementController.getGroupsList);

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
router.post('/api/supervisor/data', requireAuth, pgmController.getSupervisorData);
router.post('/api/supervisor/metrics', requireAuth, pgmController.getSupervisorMetrics);
router.post('/api/supervisor/group-details', requireAuth, pgmController.getGroupDetails);
router.get('/rede/mapa', requireAuth, pgmController.getNetworkMapPage);
router.post('/api/rede/tree', requireAuth, pgmController.getNetworkTreeAPI);
router.post('/api/supervisor/assign', requireAuth, pgmController.assignMember);
router.post('/api/supervisor/reject', requireAuth, pgmController.rejectRequest);
router.post('/api/supervisor/promote', requireAuth, pgmController.promoteToLeader);
router.post('/api/supervisor/demote', requireAuth, pgmController.demoteLeader);

// 4.1 PGM Reports
router.get('/pgm/report', requireAuth, pgmController.getReportPage);
router.post('/pgm/report/submit', requireAuth, pgmController.submitReport);
router.get('/pgm/gallery', requireAuth, pgmController.getGalleryPage);
router.post('/api/pgm/gallery-data', requireAuth, pgmController.getGalleryData);

// 5. API - Comments
router.post('/comentar', requireAuth, homeController.postComment);
router.post('/comentario/delete', requireAuth, homeController.deleteComment);

// 6. API - Admin
router.post('/api/admin/users', requireAuth, adminController.getUsers);
router.post('/api/admin/update-role', requireAuth, adminController.updateRole);

// 7. Upload PDF (Content)
router.post('/upload-pdf', requireAuth, uploadPDF.single("boletim"), contentController.uploadPdf);

module.exports = router;
