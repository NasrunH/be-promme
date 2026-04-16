const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/withdrawals/pending', protect(['FINANCE']), financeController.getLargePendingWithdrawals);
router.post('/withdrawals/:id/approve', protect(['FINANCE']), financeController.approveWithdrawal);
router.get('/withdrawals/failed', protect(['FINANCE']), financeController.getFailedWithdrawals);

router.get('/tax-calculator', protect(['FINANCE']), financeController.calculateTax);
router.get('/reports/gmv', protect(['FINANCE', 'ADMIN']), financeController.getGmvReport);
router.get('/reports/revenue', protect(['FINANCE', 'ADMIN']), financeController.getRevenueReport);

module.exports = router;
