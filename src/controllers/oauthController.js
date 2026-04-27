const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

/**
 * OAuth Callback Controller
 * Menangani callback dari OAuth providers (Meta, Google, TikTok)
 * Referensi TikTok: https://developers.tiktok.com/doc/login-kit-web
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback';

// ─────────────────────────────────────────────────────────────
// 1. HANDLE FACEBOOK CALLBACK
// ─────────────────────────────────────────────────────────────
const handleFacebookCallback = async (req, res) => {
  try {
    const { code, error, error_description, state } = req.query;

    if (error) {
      console.error('Facebook OAuth denied:', error_description);
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent(error_description || 'Akses ditolak')}&platform=FACEBOOK`
      );
    }

    if (!code) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Authorization code tidak ditemukan')}&platform=FACEBOOK`
      );
    }

    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?code=${encodeURIComponent(code)}&platform=FACEBOOK&state=${state || ''}`
    );

  } catch (error) {
    console.error('Facebook OAuth Callback Error:', error);
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Error handling Facebook callback')}&platform=FACEBOOK`
    );
  }
};

// ─────────────────────────────────────────────────────────────
// 2. HANDLE INSTAGRAM CALLBACK
// ─────────────────────────────────────────────────────────────
const handleInstagramCallback = async (req, res) => {
  try {
    const { code, error, error_description, state } = req.query;

    if (error) {
      console.error('Instagram OAuth denied:', error_description);
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent(error_description || 'Akses ditolak')}&platform=INSTAGRAM`
      );
    }

    if (!code) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Authorization code tidak ditemukan')}&platform=INSTAGRAM`
      );
    }

    // Instagram menambahkan '#_' di akhir code, perlu di-trim
    const cleanCode = code.replace('#_', '');

    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?code=${encodeURIComponent(cleanCode)}&platform=INSTAGRAM&state=${state || ''}`
    );

  } catch (error) {
    console.error('Instagram OAuth Callback Error:', error);
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Error handling Instagram callback')}&platform=INSTAGRAM`
    );
  }
};

// ─────────────────────────────────────────────────────────────
// 3. HANDLE GOOGLE/YOUTUBE CALLBACK
// ─────────────────────────────────────────────────────────────
const handleGoogleCallback = async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.error('Google OAuth denied:', error);
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Akses Google ditolak')}&platform=YOUTUBE`
      );
    }

    if (!code) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Authorization code tidak ditemukan')}&platform=YOUTUBE`
      );
    }

    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?code=${encodeURIComponent(code)}&platform=YOUTUBE&state=${state || ''}`
    );

  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Error handling Google callback')}&platform=YOUTUBE`
    );
  }
};

// ─────────────────────────────────────────────────────────────
// 4. HANDLE TIKTOK CALLBACK
// Sesuai dokumentasi: https://developers.tiktok.com/doc/login-kit-web
// Response params: code, scopes, state, error, error_description
// ─────────────────────────────────────────────────────────────
const handleTikTokCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('TikTok OAuth denied:', error_description);
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent(error_description || 'Akses TikTok ditolak')}&platform=TIKTOK`
      );
    }

    if (!code) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Authorization code tidak ditemukan')}&platform=TIKTOK`
      );
    }

    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?code=${encodeURIComponent(code)}&platform=TIKTOK&state=${state || ''}`
    );

  } catch (error) {
    console.error('TikTok OAuth Callback Error:', error);
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent('Error handling TikTok callback')}&platform=TIKTOK`
    );
  }
};

// ─────────────────────────────────────────────────────────────
// 5. GENERATE AUTHORIZATION URL
// ─────────────────────────────────────────────────────────────
const generateAuthorizationUrl = async (req, res) => {
  try {
    const { platform } = req.params;

    // Generate csrf state — sesuai dokumentasi TikTok (alphanumeric random string)
    const csrfState = crypto.randomBytes(16).toString('hex');

    let authUrl = '';

    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
        authUrl = 'https://www.facebook.com/v19.0/dialog/oauth?' +
          new URLSearchParams({
            client_id:     process.env.FB_APP_ID,
            redirect_uri:  REDIRECT_URI,
            scope:         'public_profile,email',
            response_type: 'code',
            state:         csrfState
          }).toString();
        break;

      case 'INSTAGRAM':
  authUrl = 'https://www.instagram.com/oauth/authorize?' +
    new URLSearchParams({
      client_id:     process.env.INSTAGRAM_APP_ID,    // ← bukan FB_APP_ID lagi
      redirect_uri:  REDIRECT_URI,
      scope:         'instagram_business_basic',       // ← scope baru
      response_type: 'code',
      state:         csrfState
    }).toString();
  break;

      case 'YOUTUBE':
        authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
          new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID,
            redirect_uri:  REDIRECT_URI,
            response_type: 'code',
            scope:         'https://www.googleapis.com/auth/youtube.readonly',
            access_type:   'offline',
            prompt:        'consent',
            state:         csrfState
          }).toString();
        break;

      case 'TIKTOK':
        // Sesuai dokumentasi resmi TikTok Login Kit Web:
        // - URL: https://www.tiktok.com/v2/auth/authorize/  (trailing slash wajib)
        // - TIDAK perlu PKCE (code_challenge) untuk Login Kit web
        // - Format params: application/x-www-form-urlencoded
        // - state: random alphanumeric untuk anti-CSRF
        authUrl = 'https://www.tiktok.com/v2/auth/authorize/?' +
          new URLSearchParams({
            client_key:    process.env.TIKTOK_CLIENT_KEY,
            scope:         'user.info.basic',
            response_type: 'code',
            redirect_uri:  REDIRECT_URI,
            state:         csrfState
          }).toString();
        break;

      default:
        return res.status(400).json({
          status:  'error',
          message: `Platform ${platform} tidak didukung`
        });
    }

    return res.json({
      status: 'success',
      data: {
        authorization_url: authUrl,
        platform:          platform.toUpperCase(),
        state:             csrfState
      }
    });

  } catch (error) {
    console.error('Generate Authorization URL Error:', error);
    return res.status(500).json({
      status:  'error',
      message: 'Gagal generate authorization URL'
    });
  }
};

module.exports = {
  handleFacebookCallback,
  handleInstagramCallback,
  handleGoogleCallback,
  handleTikTokCallback,
  generateAuthorizationUrl
};