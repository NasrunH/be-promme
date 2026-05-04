const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/dashboard', protect(['ADMIN']), adminController.getDashboard);
router.get('/users', protect(['ADMIN']), adminController.listUsers);
router.post('/users', protect(['ADMIN']), adminController.createUser);
router.patch('/users/:id/status', protect(['ADMIN']), adminController.updateUserStatus);
router.patch('/kyc/:creator_id', protect(['ADMIN']), adminController.reviewKyc);
router.patch('/campaigns/:campaign_id/fee', protect(['ADMIN']), adminController.updatePlatformFee);
router.patch('/campaigns/:campaign_id/status', protect(['ADMIN']), adminController.updateCampaignStatus);
router.get('/campaigns/:campaign_id', protect(['ADMIN']), adminController.getCampaignDetail);

// Fraud Ops
router.get('/fraud/anomalies', protect(['ADMIN']), adminController.getAnomalies);
router.post('/wallets/:wallet_id/hold', protect(['ADMIN']), adminController.holdWalletBalance);
router.post('/wallets/:wallet_id/release', protect(['ADMIN']), adminController.releaseWalletBalance);
router.patch('/submissions/:submission_id/invalidate', protect(['ADMIN']), adminController.invalidateSubmission);

router.get('/audit-logs', protect(['ADMIN']), adminController.getAuditLogs);

// Settings
router.get('/settings', protect(['ADMIN']), adminController.getSettings);
router.patch('/settings', protect(['ADMIN']), adminController.updateSettings);

router.patch('/submissions/:submission_id/approve', protect(['ADMIN']), adminController.approveSubmission);

module.exports = router;
