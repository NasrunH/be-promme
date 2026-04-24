const axios = require('axios');
const supabase = require('../config/supabase');

/**
 * Service untuk mengelola OAuth tokens dan refresh logic
 */

// 1. REFRESH FACEBOOK TOKEN
const refreshFacebookToken = async (refreshToken) => {
  try {
    const response = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: {
        grant_type: 'ig_refresh_token',
        access_token: refreshToken
      }
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type
    };
  } catch (error) {
    console.error('Error refreshing Facebook token:', error.message);
    throw error;
  }
};

// 2. REFRESH GOOGLE TOKEN
const refreshGoogleToken = async (refreshToken) => {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      newRefreshToken: response.data.refresh_token // Sometimes Google returns a new refresh token
    };
  } catch (error) {
    console.error('Error refreshing Google token:', error.message);
    throw error;
  }
};

// 3. REFRESH TIKTOK TOKEN
const refreshTikTokToken = async (refreshToken) => {
  try {
    const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return {
      accessToken: response.data.data.access_token,
      expiresIn: response.data.data.expires_in,
      tokenType: 'Bearer',
      newRefreshToken: response.data.data.refresh_token
    };
  } catch (error) {
    console.error('Error refreshing TikTok token:', error.message);
    throw error;
  }
};

// 4. AUTO-REFRESH TOKEN JIKA EXPIRED
const autoRefreshTokenIfNeeded = async (socialAccountId, platform) => {
  try {
    const { data: account, error } = await supabase
      .from('connected_social_accounts')
      .select('*')
      .eq('id', socialAccountId)
      .single();

    if (error) throw error;

    // Check if token is expired or about to expire (dalam 10 menit)
    const now = new Date();
    const expiryTime = new Date(account.token_expires_at);
    const timeUntilExpiry = expiryTime - now;

    if (timeUntilExpiry > 10 * 60 * 1000) {
      // Token masih valid
      return account.access_token;
    }

    // Token perlu di-refresh
    if (!account.refresh_token) {
      throw new Error(`No refresh token available for ${platform}`);
    }

    let newTokenData;

    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
      case 'INSTAGRAM':
        newTokenData = await refreshFacebookToken(account.refresh_token);
        break;
      case 'YOUTUBE':
        newTokenData = await refreshGoogleToken(account.refresh_token);
        break;
      case 'TIKTOK':
        newTokenData = await refreshTikTokToken(account.refresh_token);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    // Update token di database
    const updateData = {
      access_token: newTokenData.accessToken,
      token_expires_at: new Date(Date.now() + newTokenData.expiresIn * 1000)
    };

    if (newTokenData.newRefreshToken) {
      updateData.refresh_token = newTokenData.newRefreshToken;
    }

    const { error: updateError } = await supabase
      .from('connected_social_accounts')
      .update(updateData)
      .eq('id', socialAccountId);

    if (updateError) throw updateError;

    console.log(`[v0] Token refreshed for ${platform} account ${socialAccountId}`);
    return newTokenData.accessToken;

  } catch (error) {
    console.error('Error in autoRefreshTokenIfNeeded:', error.message);
    throw error;
  }
};

// 5. VALIDATE AKSES TOKEN (OPTIONAL: untuk check apakah token valid)
const validateAccessToken = async (accessToken, platform) => {
  try {
    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
      case 'INSTAGRAM':
        const fbResponse = await axios.get('https://graph.instagram.com/debug_token', {
          params: {
            input_token: accessToken,
            access_token: accessToken
          }
        });
        return fbResponse.data.data.is_valid;

      case 'YOUTUBE':
        await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet',
            mine: true,
            access_token: accessToken
          }
        });
        return true;

      case 'TIKTOK':
        await axios.get('https://open.tiktokapis.com/v2/user/info/', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            fields: 'open_id'
          }
        });
        return true;

      default:
        return false;
    }
  } catch (error) {
    console.error(`Token validation failed for ${platform}:`, error.message);
    return false;
  }
};

module.exports = {
  refreshFacebookToken,
  refreshGoogleToken,
  refreshTikTokToken,
  autoRefreshTokenIfNeeded,
  validateAccessToken
};
