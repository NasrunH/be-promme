const supabase = require('../config/supabase');
const speakeasy = require('speakeasy');
const axios = require('axios'); // [TAMBAHAN]: Impor axios untuk HTTP requests

// 1. SUBMIT KYC
// Fungsi Helper untuk upload ke Supabase Storage
const uploadToSupabase = async (file, folderName, userId) => {
  // Buat nama file yang unik: folder/userId_timestamp.ext
  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${folderName}/${userId}_${Date.now()}.${fileExtension}`;

  // Upload Buffer ke Supabase
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    throw new Error(`Gagal upload ${folderName}: ` + error.message);
  }

  // Dapatkan Public URL
  const { data: publicUrlData } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};
// 1. SUBMIT KYC
const submitKYC = async (req, res) => {
  try {
    const { nik, npwp } = req.body;
    const userId = req.user.id;

    // 1. Validasi Input Data
    if (!nik || nik.length !== 16) {
      return res.status(400).json({ 
        status: "error", 
        message: 'NIK wajib diisi dan harus berjumlah 16 digit.' 
      });
    }

    // 2. Validasi File Upload dari Multer
    if (!req.files || !req.files['ktp_image'] || !req.files['selfie_image']) {
      return res.status(400).json({ 
        status: "error", 
        message: 'Foto KTP dan Foto Selfie wajib diunggah.' 
      });
    }

    const ktpFile = req.files['ktp_image'][0];
    const selfieFile = req.files['selfie_image'][0];

    // 3. Upload File ke Supabase Storage
    // Menyimpan di folder yang berbeda (opsional agar rapi)
    const ktp_image_url = await uploadToSupabase(ktpFile, 'ktp', userId);
    const selfie_image_url = await uploadToSupabase(selfieFile, 'selfies', userId);

    // 4. Update data di tabel creators
    const { data, error } = await supabase
      .from('creators')
      .update({ 
        nik, 
        npwp: npwp || null, 
        ktp_image_url, 
        selfie_image_url,
        kyc_status: 'PENDING',
        updated_at: new Date()
      })
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Database Update Error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ 
        status: "error", 
        message: "Profil Creator tidak ditemukan untuk user ini." 
      });
    }

    // 5. Respon Sukses
    res.status(202).json({
      status: "success",
      message: "Data KYC diterima dan sedang diproses (PENDING)",
      data: {
        kyc_status: "PENDING",
        ktp_image_url: ktp_image_url,
        selfie_image_url: selfie_image_url
      }
    });
  } catch (error) {
    console.error('KYC Submission Error:', error);
    res.status(500).json({ 
      status: "error", 
      message: "Gagal memproses data KYC",
      details: error.message 
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: creator, error } = await supabase
      .from('creators')
      .select(`
        nik, npwp, kyc_status, ktp_image_url, selfie_image_url,
        connected_social_accounts (id, platform, username, status)
      `)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data: creator });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal mengambil profile' });
  }
};

// 2. CONNECT SOCIAL ACCOUNT - Real OAuth Implementation
const connectSocialAccount = async (req, res) => {
  try {
    const { platform, auth_code } = req.body;
    const userId = req.user.id;

    // 1. Validasi Profil Creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (creatorError || !creator) {
      return res.status(404).json({ status: 'error', message: 'Profil Creator tidak ditemukan' });
    }

    let platformAccountId = '';
    let username = '';
    let accessToken = '';
    let refreshToken = null;
    let tokenExpiresAt = null;

    const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback';

    // 2. LOGIKA OAUTH REAL PER PLATFORM
    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
      case 'INSTAGRAM':
        await handleMetaOAuth(auth_code, REDIRECT_URI, platform);
        break;

      case 'YOUTUBE':
        await handleGoogleOAuth(auth_code, REDIRECT_URI);
        break;

      case 'TIKTOK':
        await handleTikTokOAuth(auth_code, REDIRECT_URI);
        break;

      default:
        return res.status(400).json({ status: 'error', message: `Platform ${platform} tidak didukung` });
    }

    // Helper function untuk Meta OAuth
    async function handleMetaOAuth(code, redirectUri, platform) {
      const FB_APP_ID = process.env.FB_APP_ID;
      const FB_APP_SECRET = process.env.FB_APP_SECRET;

      try {
        // Step 1: Tukar authorization code dengan access token
        const tokenResponse = await axios.get('https://graph.instagram.com/v19.0/oauth/access_token', {
          params: {
            client_id: FB_APP_ID,
            client_secret: FB_APP_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code
          }
        });

        accessToken = tokenResponse.data.access_token;
        refreshToken = tokenResponse.data.refresh_token || null;

        // Step 2: Ambil informasi user
        const userResponse = await axios.get('https://graph.instagram.com/me', {
          params: {
            fields: 'id,username,name',
            access_token: accessToken
          }
        });

        platformAccountId = userResponse.data.id;
        username = userResponse.data.username || userResponse.data.name || `user_${platformAccountId}`;

        // Set token expiry (Instagram tokens typically expire in 60 days)
        tokenExpiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);

      } catch (error) {
        console.error('Meta OAuth Error:', error.response?.data || error.message);
        throw new Error(`Gagal authenticate dengan Meta: ${error.response?.data?.error?.message || error.message}`);
      }
    }

    // Helper function untuk Google OAuth
    async function handleGoogleOAuth(code, redirectUri) {
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

      try {
        // Step 1: Tukar authorization code dengan access token
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          code: code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        });

        accessToken = tokenResponse.data.access_token;
        refreshToken = tokenResponse.data.refresh_token || null;
        tokenExpiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);

        // Step 2: Ambil informasi user dari YouTube Data API
        const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet',
            mine: true,
            access_token: accessToken
          }
        });

        if (channelResponse.data.items && channelResponse.data.items.length > 0) {
          const channel = channelResponse.data.items[0];
          platformAccountId = channel.id;
          username = channel.snippet.title || `Channel_${platformAccountId}`;
        } else {
          throw new Error('Channel YouTube tidak ditemukan');
        }

      } catch (error) {
        console.error('Google OAuth Error:', error.response?.data || error.message);
        throw new Error(`Gagal authenticate dengan Google: ${error.response?.data?.error_description || error.message}`);
      }
    }

    // Helper function untuk TikTok OAuth
    async function handleTikTokOAuth(code, redirectUri) {
      const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
      const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

      try {
        // Step 1: Tukar authorization code dengan access token
        const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
          client_key: TIKTOK_CLIENT_KEY,
          client_secret: TIKTOK_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        accessToken = tokenResponse.data.data.access_token;
        refreshToken = tokenResponse.data.data.refresh_token || null;
        tokenExpiresAt = new Date(Date.now() + tokenResponse.data.data.expires_in * 1000);

        // Step 2: Ambil informasi user dari TikTok API
        const userResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            fields: 'open_id,union_id,display_name'
          }
        });

        if (userResponse.data.data && userResponse.data.data.user) {
          const user = userResponse.data.data.user;
          platformAccountId = user.open_id;
          username = user.display_name || `TikTok_${platformAccountId}`;
        } else {
          throw new Error('TikTok user information not found');
        }

      } catch (error) {
        console.error('TikTok OAuth Error:', error.response?.data || error.message);
        throw new Error(`Gagal authenticate dengan TikTok: ${error.response?.data?.message || error.message}`);
      }
    }

    // 3. SIMPAN ATAU PERBARUI KE DATABASE (UPSERT Logic)
    const { data: existingAccount } = await supabase
      .from('connected_social_accounts')
      .select('id')
      .eq('creator_id', creator.id)
      .eq('platform', platform.toUpperCase())
      .maybeSingle();

    let savedAccount;
    const accountData = {
      platform_account_id: platformAccountId,
      username: username,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      status: 'VERIFIED'
    };

    if (existingAccount) {
      const { data, error } = await supabase
        .from('connected_social_accounts')
        .update({ ...accountData, updated_at: new Date() })
        .eq('id', existingAccount.id)
        .select()
        .single();
      if (error) throw error;
      savedAccount = data;
    } else {
      const { data, error } = await supabase
        .from('connected_social_accounts')
        .insert([{
          creator_id: creator.id,
          platform: platform.toUpperCase(),
          ...accountData
        }])
        .select()
        .single();
      if (error) throw error;
      savedAccount = data;
    }

    res.status(201).json({
      status: 'success',
      message: `Akun ${platform} berhasil dihubungkan`,
      data: {
        connected_account_id: savedAccount.id,
        platform: savedAccount.platform,
        username: savedAccount.username,
        status: savedAccount.status
      }
    });

  } catch (error) {
    console.error('Error Connect Social:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message || 'Gagal menghubungkan akun sosial media' 
    });
  }
};

// 3. REGISTER BANK ACCOUNT
const registerBankAccount = async (req, res) => {
  try {
    const { bank_code, account_number, account_name } = req.body;
    const userId = req.user.id;

    const { data: creator } = await supabase.from('creators').select('id, kyc_status').eq('user_id', userId).single();

    if (creator.kyc_status !== 'VERIFIED') {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak. Anda harus menyelesaikan verifikasi KYC terlebih dahulu untuk mendaftarkan rekening bank.'
      });
    }

    const { data: bankAcc, error } = await supabase
      .from('creator_bank_accounts')
      .insert([{
        creator_id: creator.id,
        bank_code,
        account_number,
        account_name,
        status: 'PENDING'
      }])
      .select().single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      data: {
        bank_account_id: bankAcc.id,
        status: 'PENDING_VERIFICATION'
      }
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal mendaftarkan rekening' });
  }
};

const getBankAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    if (!creator) return res.status(404).json({ status: 'error', message: 'Creator tidak ditemukan' });

    const { data, error } = await supabase
      .from('creator_bank_accounts')
      .select('*')
      .eq('creator_id', creator.id)
      .order('is_primary', { ascending: false });

    if (error) throw error;
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar rekening' });
  }
};

const updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { bank_code, account_number, account_name } = req.body;
    const userId = req.user.id;
    
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    
    const { data, error } = await supabase
      .from('creator_bank_accounts')
      .update({ bank_code, account_number, account_name, updated_at: new Date() })
      .eq('id', id)
      .eq('creator_id', creator.id)
      .select().single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui rekening' });
  }
};

const deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    
    const { error } = await supabase
      .from('creator_bank_accounts')
      .delete()
      .eq('id', id)
      .eq('creator_id', creator.id);

    if (error) throw error;
    res.status(200).json({ status: 'success', message: 'Rekening berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal menghapus rekening' });
  }
};

// 4. SETUP 2FA
const setup2FA = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: "Promme Backend" });
    const userId = req.user.id;

    await supabase.from('users').update({ two_factor_secret: secret.base32 }).eq('id', userId);

    res.status(200).json({ 
        status: 'success', 
        data: { 
            secret: secret.base32, 
            otpauth_url: secret.otpauth_url 
        } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Gagal setup 2FA' });
  }
};

// 5. VERIFY 2FA
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    const { data: user } = await supabase.from('users').select('two_factor_secret').eq('id', userId).single();
    
    if (!user.two_factor_secret) {
        return res.status(400).json({ status: 'error', message: 'Anda belum setup 2FA' });
    }

    const verified = speakeasy.totp.verify({ 
        secret: user.two_factor_secret, 
        encoding: 'base32', 
        token 
    });

    if (verified) {
       await supabase.from('users').update({ is_2fa_enabled: true }).eq('id', userId);
       res.status(200).json({ status: 'success', message: '2FA berhasil diaktifkan' });
    } else {
       res.status(400).json({ status: 'error', message: 'Token salah atau kadaluarsa' });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal verifikasi 2FA' });
  }
};


module.exports = { 
  submitKYC, connectSocialAccount, registerBankAccount, 
  getBankAccounts, updateBankAccount, deleteBankAccount,
  setup2FA, verify2FA, getProfile 
};
