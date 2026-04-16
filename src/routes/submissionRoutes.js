const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');

// Gunakan fungsi protect bawaan Anda
const { protect } = require('../middlewares/authMiddleware');

// Validasi otorisasi: Wajib role 'CREATOR'
router.use(protect(['CREATOR']));

// Endpoint 4.3: Cek Semua Riwayat Submission
router.get('/', submissionController.getAllSubmissions);

// Endpoint 4.1: Submit Konten Baru
router.post('/', submissionController.submitContent);

// Endpoint 4.2: Cek Status Submission
router.get('/:submission_id', submissionController.getSubmissionStatus);

module.exports = router;