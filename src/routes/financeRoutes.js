const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/withdrawals/pending', protect(['FINANCE', 'ADMIN']), financeController.getPendingWithdrawals);
router.post('/withdrawals/:id/approve', protect(['FINANCE', 'ADMIN']), financeController.approveWithdrawal);
router.post('/withdrawals/:id/reject', protect(['FINANCE', 'ADMIN']), financeController.rejectWithdrawal);
router.get('/withdrawals/failed', protect(['FINANCE', 'ADMIN']), financeController.getFailedWithdrawals);
router.get('/withdrawals/recent', protect(['FINANCE', 'ADMIN']), financeController.getRecentWithdrawals);

router.get('/tax-calculator', protect(['FINANCE']), financeController.calculateTax);
router.get('/reports/gmv', protect(['FINANCE', 'ADMIN']), financeController.getGmvReport);
router.get('/reports/revenue', protect(['FINANCE', 'ADMIN']), financeController.getRevenueReport);

module.exports = router;
