const midtransClient = require('midtrans-client');

// Memasukkan konfigurasi dari environment variables
const midtransConfig = {
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
};

// Instance untuk Core API
const coreApi = new midtransClient.CoreApi(midtransConfig);

// Instance untuk Snap API
const snap = new midtransClient.Snap(midtransConfig);

module.exports = { coreApi, snap };