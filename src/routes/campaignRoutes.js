const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Webhook
router.post('/midtrans-webhook', campaignController.handleMidtransNotification);

// Creator
router.get('/explore', protect(['CREATOR']), campaignController.exploreCampaigns);

// Brand
router.post('/', protect(['BRAND']), upload.array('asset_files', 5), campaignController.createCampaign);
router.get('/my-campaigns', protect(['BRAND']), campaignController.getBrandCampaigns);
router.post('/:campaign_id/topup', protect(['BRAND']), campaignController.topupBudget);
router.patch('/:campaign_id/status', protect(['BRAND']), campaignController.updateCampaignStatus);
router.put('/:campaign_id', protect(['BRAND']), upload.array('asset_files', 5), campaignController.updateCampaign);
router.put('/:campaign_id/limit', protect(['BRAND']), campaignController.updateCampaignLimit);
router.post('/:campaign_id/refund', protect(['BRAND']), campaignController.claimRefund);
router.get('/:campaign_id/analytics', protect(['BRAND', 'ADMIN']), campaignController.getCampaignAnalytics);

module.exports = router;