const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/profile', protect(['BRAND']), brandController.getProfile);
router.put('/profile', protect(['BRAND']), brandController.updateProfile);
router.get('/dashboard', protect(['BRAND']), brandController.getDashboard);

module.exports = router;
