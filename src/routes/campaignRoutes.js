const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { protect } = require('../middlewares/authMiddleware');

// Base URL: /api/v1/campaigns

// Creator Routes
router.get('/explore', protect(['CREATOR']), campaignController.exploreCampaigns);

// Brand Routes
router.post('/', protect(['BRAND']), campaignController.createCampaign);
router.post('/:campaign_id/topup', protect(['BRAND']), campaignController.topupBudget);
router.patch('/:campaign_id/status', protect(['BRAND']), campaignController.updateCampaignStatus);
router.put('/:campaign_id/limit', protect(['BRAND']), campaignController.updateCampaignLimit);
router.post('/:campaign_id/refund', protect(['BRAND']), campaignController.claimRefund);
router.get('/:campaign_id/analytics', protect(['BRAND', 'ADMIN']), campaignController.getCampaignAnalytics);

module.exports = router;
