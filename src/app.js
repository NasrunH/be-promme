const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Imports
const { initCronJobs } = require('./utils/cronJobs');
const { initTrafficTracker } = require('./jobs/trafficTracker');
const authRoutes = require('./routes/authRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const walletRoutes = require('./routes/walletRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const brandRoutes = require('./routes/brandRoutes');
const adminRoutes = require('./routes/adminRoutes');
const financeRoutes = require('./routes/financeRoutes');

const app = express();

// 1. INITIALIZE BACKGROUND WORKERS
initCronJobs();
initTrafficTracker();

// 2. MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 3. ROUTES (v1 API according to api.txt specification)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/creators', creatorRoutes);
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/submissions', submissionRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/brand', brandRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/finance', financeRoutes);

// Health Check Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Promme API v1 is running',
    version: '1.0.0',
    timestamp: new Date()
  });
});

// 4. ERROR HANDLING
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    status: 'error',
    message: `Rute ${req.originalUrl} tidak ditemukan di server.` 
  });
});

// Centralized error boundary
app.use((err, req, res, next) => {
  console.error('Server Internal Error:', err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Terjadi kesalahan sistem internal.'
  });
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(morgan('dev'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server berjalan di http://localhost:${PORT}
  👉 API Base: http://localhost:${PORT}/api/v1
  `);
});