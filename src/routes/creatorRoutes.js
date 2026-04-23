// src/routes/creatorRoutes.js
const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer'); // Tambahkan multer

// Konfigurasi Multer Memory Storage (Maksimal 5MB per file)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Update endpoint /kyc dengan middleware upload fields
// Menerima field form-data: 'ktp_image' dan 'selfie_image'
router.post('/kyc', 
  protect(['CREATOR']), 
  upload.fields([
    { name: 'ktp_image', maxCount: 1 },
    { name: 'selfie_image', maxCount: 1 }
  ]), 
  creatorController.submitKYC
);
router.get('/profile', protect(['CREATOR']), creatorController.getProfile);
router.post('/social-accounts/connect', protect(['CREATOR']), creatorController.connectSocialAccount);
router.post('/bank-accounts', protect(['CREATOR']), creatorController.registerBankAccount);
router.get('/bank-accounts', protect(['CREATOR']), creatorController.getBankAccounts);
router.patch('/bank-accounts/:id', protect(['CREATOR']), creatorController.updateBankAccount);
router.delete('/bank-accounts/:id', protect(['CREATOR']), creatorController.deleteBankAccount);
router.post('/2fa/setup', protect(['CREATOR']), creatorController.setup2FA);
router.post('/2fa/verify', protect(['CREATOR']), creatorController.verify2FA);

module.exports = router;