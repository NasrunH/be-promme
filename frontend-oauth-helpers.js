/**
 * OAuth Helper Utilities for Frontend
 * Use these in your React/Vue/Angular application
 * 
 * Installation:
 * 1. Copy this file to your frontend project
 * 2. Import and use the functions
 * 3. Make sure JWT token is stored in localStorage or cookies
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
const API_BASE = `${BACKEND_URL}/api`;

// Get JWT token from localStorage (adjust based on your setup)
const getJWTToken = () => {
  return localStorage.getItem('jwt_token') || 
         sessionStorage.getItem('jwt_token') || 
         localStorage.getItem('access_token');
};

// ============================================================================
// OAUTH HELPER FUNCTIONS
// ============================================================================

/**
 * Get authorization URL for a specific OAuth platform
 * @param {string} platform - INSTAGRAM, YOUTUBE, or TIKTOK
 * @returns {Promise<string>} Authorization URL
 */
export async function getOAuthAuthorizationUrl(platform) {
  try {
    const response = await fetch(`${API_BASE}/creators/oauth/authorize/${platform}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to get authorization URL');
    }

    return data.data.authorization_url;
  } catch (error) {
    console.error('[OAuth] Error getting authorization URL:', error);
    throw error;
  }
}

/**
 * Redirect user to OAuth provider for authorization
 * @param {string} platform - INSTAGRAM, YOUTUBE, or TIKTOK
 */
export async function redirectToOAuthProvider(platform) {
  try {
    const authUrl = await getOAuthAuthorizationUrl(platform);
    
    // Store platform in session for later reference
    sessionStorage.setItem('oauth_platform', platform);
    
    // Redirect to OAuth provider
    window.location.href = authUrl;
  } catch (error) {
    console.error('[OAuth] Error redirecting to provider:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for social account connection
 * @param {string} platform - INSTAGRAM, YOUTUBE, or TIKTOK
 * @param {string} authCode - Authorization code from OAuth callback
 * @returns {Promise<Object>} Connected account data
 */
export async function exchangeAuthCodeForConnection(platform, authCode) {
  try {
    const jwtToken = getJWTToken();
    
    if (!jwtToken) {
      throw new Error('JWT token not found. Please login first.');
    }

    const response = await fetch(`${API_BASE}/creators/social-accounts/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: platform.toUpperCase(),
        auth_code: authCode
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to connect social account');
    }

    return data.data;
  } catch (error) {
    console.error('[OAuth] Error exchanging auth code:', error);
    throw error;
  }
}

/**
 * Get list of connected social accounts
 * @returns {Promise<Array>} Array of connected accounts
 */
export async function getConnectedSocialAccounts() {
  try {
    const jwtToken = getJWTToken();
    
    if (!jwtToken) {
      throw new Error('JWT token not found. Please login first.');
    }

    const response = await fetch(`${API_BASE}/creators/profile`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to get profile');
    }

    return data.data.connected_social_accounts || [];
  } catch (error) {
    console.error('[OAuth] Error getting connected accounts:', error);
    throw error;
  }
}

/**
 * Handle OAuth callback from provider
 * This function should be called in your /oauth/callback component
 * @returns {Promise<Object>} Connected account data or null if not in callback
 */
export async function handleOAuthCallback() {
  try {
    // Get query parameters from URL
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    // Handle errors from provider
    if (error) {
      const errorDescription = params.get('error_description');
      throw new Error(`OAuth Error: ${error} - ${errorDescription || 'Unknown error'}`);
    }

    // No auth code found (not a callback)
    if (!authCode) {
      return null;
    }

    // Get platform from session storage
    const platform = sessionStorage.getItem('oauth_platform');
    
    if (!platform) {
      throw new Error('Platform information not found in session');
    }

    console.log('[OAuth] Handling callback for platform:', platform);

    // Exchange code for account connection
    const connectedAccount = await exchangeAuthCodeForConnection(platform, authCode);

    // Clear session data
    sessionStorage.removeItem('oauth_platform');
    sessionStorage.removeItem('oauth_state');

    console.log('[OAuth] Successfully connected:', connectedAccount);
    return connectedAccount;

  } catch (error) {
    console.error('[OAuth] Error handling callback:', error);
    throw error;
  }
}

/**
 * Get authorization URL for multiple platforms
 * @returns {Promise<Object>} Object with URLs for each platform
 */
export async function getAuthorizationUrlsForAllPlatforms() {
  const platforms = ['INSTAGRAM', 'YOUTUBE', 'TIKTOK'];
  const urls = {};

  try {
    for (const platform of platforms) {
      try {
        urls[platform] = await getOAuthAuthorizationUrl(platform);
      } catch (error) {
        console.error(`[OAuth] Error getting URL for ${platform}:`, error);
        urls[platform] = null;
      }
    }

    return urls;
  } catch (error) {
    console.error('[OAuth] Error getting authorization URLs:', error);
    throw error;
  }
}

// ============================================================================
// REACT HOOKS (if using React)
// ============================================================================

/**
 * React Hook for OAuth connection
 * 
 * Usage:
 * const { loading, error, connect } = useOAuthConnection();
 * <button onClick={() => connect('INSTAGRAM')}>Connect Instagram</button>
 */
export function useOAuthConnection() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const connect = async (platform) => {
    setLoading(true);
    setError(null);

    try {
      await redirectToOAuthProvider(platform);
    } catch (err) {
      setError(err.message || 'Failed to initiate OAuth flow');
      setLoading(false);
    }
  };

  return { loading, error, connect };
}

/**
 * React Hook for handling OAuth callback
 * 
 * Usage:
 * const { loading, error, connectedAccount } = useOAuthCallback();
 */
export function useOAuthCallback() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [connectedAccount, setConnectedAccount] = React.useState(null);

  React.useEffect(() => {
    const handleCallback = async () => {
      try {
        const account = await handleOAuthCallback();
        setConnectedAccount(account);
      } catch (err) {
        setError(err.message || 'Failed to handle OAuth callback');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, []);

  return { loading, error, connectedAccount };
}

/**
 * React Hook for fetching connected accounts
 * 
 * Usage:
 * const { accounts, loading, error, refetch } = useConnectedSocialAccounts();
 */
export function useConnectedSocialAccounts() {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refetch = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getConnectedSocialAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch connected accounts');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refetch();
  }, []);

  return { accounts, loading, error, refetch };
}

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const OAUTH_ERROR_MESSAGES = {
  INVALID_AUTH_CODE: 'Authorization code is invalid or expired. Please try again.',
  CREATOR_NOT_FOUND: 'You must register as a creator first.',
  JWT_NOT_FOUND: 'Please login first.',
  PLATFORM_NOT_SUPPORTED: 'This platform is not supported yet.',
  OAUTH_PROVIDER_ERROR: 'OAuth provider returned an error. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.'
};

/**
 * Get user-friendly error message
 * @param {Error|string} error - Error object or message
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
  const message = error?.message || error;

  if (message.includes('Invalid authorization code')) {
    return OAUTH_ERROR_MESSAGES.INVALID_AUTH_CODE;
  }
  if (message.includes('Creator')) {
    return OAUTH_ERROR_MESSAGES.CREATOR_NOT_FOUND;
  }
  if (message.includes('JWT')) {
    return OAUTH_ERROR_MESSAGES.JWT_NOT_FOUND;
  }
  if (message.includes('not supported')) {
    return OAUTH_ERROR_MESSAGES.PLATFORM_NOT_SUPPORTED;
  }
  if (message.includes('OAuth')) {
    return OAUTH_ERROR_MESSAGES.OAUTH_PROVIDER_ERROR;
  }
  if (message.includes('Network')) {
    return OAUTH_ERROR_MESSAGES.NETWORK_ERROR;
  }

  return OAUTH_ERROR_MESSAGES.UNKNOWN_ERROR;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getOAuthAuthorizationUrl,
  redirectToOAuthProvider,
  exchangeAuthCodeForConnection,
  getConnectedSocialAccounts,
  handleOAuthCallback,
  getAuthorizationUrlsForAllPlatforms,
  useOAuthConnection,
  useOAuthCallback,
  useConnectedSocialAccounts,
  getErrorMessage,
  OAUTH_ERROR_MESSAGES
};
