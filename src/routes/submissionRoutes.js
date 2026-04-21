const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect(['CREATOR']));

// Cek Semua Riwayat Submission
router.get('/', submissionController.getAllSubmissions);

// Submit Konten Baru
router.post('/', submissionController.submitContent);

// Submission per Campaign (tracking)
router.get('/by-campaign/:campaign_id', submissionController.getSubmissionsByCampaign);

// Cek Status Submission tunggal
router.get('/:submission_id', submissionController.getSubmissionStatus);

module.exports = router;