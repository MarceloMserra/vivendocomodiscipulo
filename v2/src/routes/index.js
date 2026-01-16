const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Public Pages
router.get('/', homeController.getHomePage);
router.get('/login', homeController.getLoginPage);
router.get('/register', homeController.getRegisterPage);
router.get('/profile', homeController.getProfilePage);

module.exports = router;
