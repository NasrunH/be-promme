const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// URL: /api/v1/auth/register/brand
router.post('/register/brand', authController.registerBrand);

// URL: /api/v1/auth/register/creator
router.post('/register/creator', authController.registerCreator);

// URL: /api/v1/auth/login
router.post('/login', authController.login);

module.exports = router;