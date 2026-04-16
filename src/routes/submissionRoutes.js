const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { protect } = require('../middlewares/authMiddleware');

// Base URL: /api/v1/submissions
router.post('/', protect(['CREATOR']), submissionController.submitContent);
router.get('/me', protect(['CREATOR']), submissionController.getMySubmissions);
router.get('/:submission_id', protect(['CREATOR', 'BRAND', 'ADMIN']), submissionController.checkStatus);

module.exports = router;
