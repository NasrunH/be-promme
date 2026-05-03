const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.get('/profile', protect(['BRAND']), brandController.getProfile);
router.put('/profile', protect(['BRAND']), upload.single('logo_file'), brandController.updateProfile);
router.get('/dashboard', protect(['BRAND']), brandController.getDashboard);

module.exports = router;
