const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Perhatikan: path di sini '/register', karena sudah di-prefix '/api/auth' di app.js
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;