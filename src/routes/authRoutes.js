const express = require('express');
const router = express.Router();
const { registerBrand, registerCreator, login } = require('../controllers/authController');

// 1.1 Registrasi Brand
router.post('/register/brand', registerBrand);

// 1.2 Registrasi Creator
router.post('/register/creator', registerCreator);

// Login
router.post('/login', login);

module.exports = router;