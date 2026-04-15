const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Pastikan import ini benar jalurnya
const authRoutes = require('./routes/authRoutes');

const app = express();

// 1. MIDDLEWARE (Wajib di atas routes)
app.use(cors());
app.use(express.json()); // Supaya bisa baca JSON dari Postman
app.use(morgan('dev')); // Untuk melihat log request di terminal

// 2. ROUTES
// Ini adalah baris yang mendaftarkan /api/auth
app.use('/api/auth', authRoutes);

// Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'Promme API is running' });
});

// 3. ERROR HANDLING (Wajib di paling bawah)
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    status: 'error',
    message: `Rute ${req.originalUrl} tidak ditemukan di server.` 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server berjalan di http://localhost:${PORT}
  👉 Endpoint Registrasi: http://localhost:${PORT}/api/auth/register
  `);
});