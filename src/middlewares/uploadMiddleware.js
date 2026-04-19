// --- src/middlewares/uploadMiddleware.js ---
const multer = require('multer');

// Simpan file di memory sementara sebagai Buffer
const storage = multer.memoryStorage();

// Filter: Pastikan hanya gambar atau video yang bisa diupload
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung! Hanya gambar atau video.'), false);
  }
};

// Maksimal ukuran 10MB per file
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } 
});

module.exports = upload;