const axios = require('axios');
require('dotenv').config();

/**
 * OAuth Callback Controller
 * Menangani callback dari OAuth providers (Meta, Google, TikTok)
 */

// 1. HANDLE FACEBOOK/INSTAGRAM CALLBACK
const handleFacebookCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Authorization code tidak ditemukan' });
    }

    // Validasi state (optional, untuk security)
    // const storedState = req.session.oauthState;
    // if (state !== storedState) {
    //   return res.status(400).json({ status: 'error', message: 'Invalid state parameter' });
    // }

    // Return authorization code ke frontend (frontend akan mengirimkannya ke backend via /social-accounts/connect)
    res.json({
      status: 'success',
      message: 'Authorization code received. Send this code to /api/creators/social-accounts/connect',
      data: {
        code: code,
        platform: 'FACEBOOK'
      }
    });

  } catch (error) {
    console.error('Facebook OAuth Callback Error:', error);
    res.status(500).json({ status: 'error', message: 'Error handling Facebook callback' });
  }
};

// 2. HANDLE GOOGLE/YOUTUBE CALLBACK
const handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Authorization code tidak ditemukan' });
    }

    // Return authorization code ke frontend
    res.json({
      status: 'success',
      message: 'Authorization code received. Send this code to /api/creators/social-accounts/connect',
      data: {
        code: code,
        platform: 'YOUTUBE'
      }
    });

  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    res.status(500).json({ status: 'error', message: 'Error handling Google callback' });
  }
};

// 3. HANDLE TIKTOK CALLBACK
const handleTikTokCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Authorization code tidak ditemukan' });
    }

    // Return authorization code ke frontend
    res.json({
      status: 'success',
      message: 'Authorization code received. Send this code to /api/creators/social-accounts/connect',
      data: {
        code: code,
        platform: 'TIKTOK'
      }
    });

  } catch (error) {
    console.error('TikTok OAuth Callback Error:', error);
    res.status(500).json({ status: 'error', message: 'Error handling TikTok callback' });
  }
};

// 4. GENERATE AUTHORIZATION URL (Untuk frontend)
const generateAuthorizationUrl = async (req, res) => {
  try {
    const { platform } = req.params;
    const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback';

    let authUrl = '';

    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
        authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
          `client_id=${process.env.FB_APP_ID}&` +
          `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
          `scope=public_profile,email&` +
          `state=${Date.now()}`;
        break;

      case 'INSTAGRAM':
        authUrl = `https://api.instagram.com/oauth/authorize?` +
          `client_id=${process.env.FB_APP_ID}&` +
          `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
          `scope=user_profile,user_media&` +
          `response_type=code&` +
          `state=${Date.now()}`;
        break;

      case 'YOUTUBE':
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly')}&` +
          `access_type=offline&` +
          `state=${Date.now()}`;
        break;

      case 'TIKTOK':
        authUrl = `https://www.tiktok.com/v1/oauth/authorize?` +
          `client_key=${process.env.TIKTOK_CLIENT_KEY}&` +
          `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
          `scope=${encodeURIComponent('user.info.basic')}&` +
          `response_type=code&` +
          `state=${Date.now()}`;
        break;

      default:
        return res.status(400).json({ status: 'error', message: `Platform ${platform} tidak didukung` });
    }

    res.json({
      status: 'success',
      data: {
        authorization_url: authUrl
      }
    });

  } catch (error) {
    console.error('Generate Authorization URL Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal generate authorization URL' });
  }
};

module.exports = {
  handleFacebookCallback,
  handleGoogleCallback,
  handleTikTokCallback,
  generateAuthorizationUrl
};
