const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');
const { protect } = require('../middlewares/authMiddleware');

// Base URL: /api/v1/creators
router.post('/kyc', protect(['CREATOR']), creatorController.submitKYC);
router.post('/social-accounts/connect', protect(['CREATOR']), creatorController.connectSocialAccount);
router.post('/bank-accounts', protect(['CREATOR']), creatorController.registerBankAccount);

router.post('/2fa/setup', protect(['CREATOR']), creatorController.setup2FA);
router.post('/2fa/verify', protect(['CREATOR']), creatorController.verify2FA);

module.exports = router;

