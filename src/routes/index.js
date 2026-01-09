const express = require('express');
const router = express.Router();
const { uploadImage, uploadPDF } = require('../config/upload');

// Controllers
const homeController = require('../controllers/homeController');
const userController = require('../controllers/userController');
const pgmController = require('../controllers/pgmController');
const adminController = require('../controllers/adminController');
const contentController = require('../controllers/contentController');

// --- Routes ---

// 1. Home & Auth Pages
router.get('/', homeController.getHomePage);
router.get('/login', homeController.getLoginPage);
router.get('/register', homeController.getRegisterPage);
router.get('/profile', homeController.getProfilePage);

// 2. Admin Pages
router.get('/admin', adminController.getAdminPage);
router.get('/pgm', pgmController.getPgmPage);

// 3. API - User Profile
router.post('/api/profile/update', uploadImage.single("photo"), userController.updateProfile);
router.post('/api/user-data', userController.getUserData);

// 4. API - PGM
router.post('/api/my-pgm', pgmController.getMyPgm);
router.post('/pgm/add', pgmController.addMember);
router.post('/pgm/remove', pgmController.removeMember);
router.post('/pgm/post', pgmController.addPost);
router.post('/pgm/delete-post', pgmController.deletePost);
router.post('/api/pgm/request', pgmController.requestEntry);
router.post('/api/supervisor/data', pgmController.getSupervisorData);
router.post('/api/supervisor/assign', pgmController.assignMember);

// 5. API - Comments
router.post('/comentar', homeController.postComment);
router.post('/comentario/delete', homeController.deleteComment);

// 6. API - Admin
router.post('/api/admin/users', adminController.getUsers);
router.post('/api/admin/update-role', adminController.updateRole);

// 7. Upload PDF (Content)
router.post('/upload-pdf', uploadPDF.single("boletim"), contentController.uploadPdf);

module.exports = router;
