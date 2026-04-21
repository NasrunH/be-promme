const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middlewares/authMiddleware');

// Base URL: /api/v1/wallets
router.get('/me', protect(['CREATOR']), walletController.getWalletBalance);
router.post('/withdraw', protect(['CREATOR']), walletController.requestWithdrawal);
router.get('/transactions', protect(['CREATOR']), walletController.getWalletTransactions);
router.get('/earnings', protect(['CREATOR']), walletController.getEarningDetails);

module.exports = router;
