const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Base URL: /api/v1/webhooks/midtrans
router.post('/payment', webhookController.handlePaymentWebhook);
router.post('/payout', webhookController.handlePayoutWebhook);

module.exports = router;
