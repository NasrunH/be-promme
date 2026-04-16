const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');

// Gunakan fungsi protect bawaan Anda (Jangan ubah nama impornya)
const { protect } = require('../middlewares/authMiddleware');

// Validasi otorisasi: Wajib role 'CREATOR' untuk semua endpoint di bawah
router.use(protect(['CREATOR']));

// Endpoint 2.1: Submit KYC
router.post('/kyc', creatorController.submitKyc);

// Endpoint 2.2: Hubungkan Akun Sosial Media
router.post('/social-accounts/connect', creatorController.connectSocialAccount);

// Endpoint 2.3: Daftarkan Rekening Bank
router.post('/bank-accounts', creatorController.registerBankAccount);

module.exports = router;