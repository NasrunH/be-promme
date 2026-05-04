const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// URL: /api/v1/auth/register/brand
router.post('/register/brand', authController.registerBrand);

// URL: /api/v1/auth/register/creator
router.post('/register/creator', authController.registerCreator);

// URL: /api/v1/auth/login
router.post('/login', authController.login);

// URL: /api/v1/auth/change-password
router.put('/change-password', protect(), authController.changePassword);

// URL: /api/v1/auth/me
router.get('/me', protect(), authController.getMe);

// URL: /api/v1/auth/profile
router.put('/profile', protect(), upload.single('profile_picture'), authController.updateProfile);

module.exports = router;