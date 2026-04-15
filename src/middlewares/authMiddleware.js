const jwt = require('jsonwebtoken');
require('dotenv').config();

// Nama File: src/middlewares/authMiddleware.js
// Middleware untuk memvalidasi Token dan Role
const protect = (allowedRoles = []) => {
  return (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Akses ditolak, token tidak ditemukan' });
    }

    try {
      // Verifikasi Token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_promme');
      req.user = decoded;

      // Cek Role (Jika ada batasan role)
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Anda tidak memiliki akses ke fitur ini' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token tidak valid' });
    }
  };
};

module.exports = { protect };