const supabase = require('../config/supabase');
const speakeasy = require('speakeasy');
const axios = require('axios'); // [TAMBAHAN]: Impor axios untuk HTTP requests
const { parsePagination, formatPaginationResponse } = require('../utils/pagination');
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
        nama_lengkap, nik, npwp, kyc_status, ktp_image_url, selfie_image_url,
        users (email, status, phone_number),
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
 
    const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback';
 
    // 1. Validasi Profil Creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', userId)
      .single();
 
    if (creatorError || !creator) {
      return res.status(404).json({ status: 'error', message: 'Profil Creator tidak ditemukan' });
    }
 
    // ─────────────────────────────────────────────
    // HELPER: Meta OAuth (Facebook & Instagram)
    // ─────────────────────────────────────────────
    async function handleMetaOAuth(code, redirectUri, platform) {
      const FB_APP_ID = process.env.FB_APP_ID;
      const FB_APP_SECRET = process.env.FB_APP_SECRET;
 
      try {
        let tokenUrl;
        let tokenParams;
 
        if (platform.toUpperCase() === 'FACEBOOK') {
          // Facebook Graph API — pakai GET dengan query params
          tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
          tokenParams = {
            client_id: FB_APP_ID,
            client_secret: FB_APP_SECRET,
            redirect_uri: redirectUri,
            code: code
          };
          const tokenResponse = await axios.get(tokenUrl, { params: tokenParams });
          const accessToken = tokenResponse.data.access_token;
          const refreshToken = tokenResponse.data.refresh_token || null;
          // Facebook long-lived token biasanya ~60 hari
          const tokenExpiresAt = new Date(Date.now() + (tokenResponse.data.expires_in || 5184000) * 1000);
 
          // Ambil info user Facebook
          const userResponse = await axios.get('https://graph.facebook.com/me', {
            params: {
              fields: 'id,name',
              access_token: accessToken
            }
          });
 
          const platformAccountId = userResponse.data.id;
          const username = userResponse.data.name || `fb_user_${platformAccountId}`;
 
          return { platformAccountId, username, accessToken, refreshToken, tokenExpiresAt };
 
        } else {
          // Instagram Basic Display API — pakai POST dengan form-urlencoded
          tokenUrl = 'https://api.instagram.com/oauth/access_token';
          const tokenResponse = await axios.post(
            tokenUrl,
            new URLSearchParams({
              client_id: FB_APP_ID,
              client_secret: FB_APP_SECRET,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri,
              code: code
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );
 
          const shortLivedToken = tokenResponse.data.access_token;
 
          // Tukar ke long-lived token (opsional tapi direkomendasikan)
          const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
            params: {
              grant_type: 'ig_exchange_token',
              client_secret: FB_APP_SECRET,
              access_token: shortLivedToken
            }
          });
 
          const accessToken = longLivedResponse.data.access_token;
          const refreshToken = null; // Instagram tidak punya refresh token standar
          // Long-lived Instagram token berlaku 60 hari
          const tokenExpiresAt = new Date(Date.now() + (longLivedResponse.data.expires_in || 5184000) * 1000);
 
          // Ambil info user Instagram
          const userResponse = await axios.get('https://graph.instagram.com/me', {
            params: {
              fields: 'id,username',
              access_token: accessToken
            }
          });
 
          const platformAccountId = userResponse.data.id;
          const username = userResponse.data.username || `ig_user_${platformAccountId}`;
 
          return { platformAccountId, username, accessToken, refreshToken, tokenExpiresAt };
        }
 
      } catch (error) {
        console.error('Meta OAuth Error:', error.response?.data || error.message);
        throw new Error(`Gagal authenticate dengan Meta: ${error.response?.data?.error?.message || error.message}`);
      }
    }
 
    // ─────────────────────────────────────────────
    // HELPER: Google OAuth (YouTube)
    // ─────────────────────────────────────────────
    async function handleGoogleOAuth(code, redirectUri) {
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
 
      try {
        // Tukar authorization code dengan access token
        const tokenResponse = await axios.post(
          'https://oauth2.googleapis.com/token',
          new URLSearchParams({
            code: code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
 
        const accessToken = tokenResponse.data.access_token;
        const refreshToken = tokenResponse.data.refresh_token || null;
        const tokenExpiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);
 
        // Ambil informasi channel YouTube
        const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet',
            mine: true
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
 
        if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
          throw new Error('Channel YouTube tidak ditemukan');
        }
 
        const channel = channelResponse.data.items[0];
        const platformAccountId = channel.id;
        const username = channel.snippet.title || `Channel_${platformAccountId}`;
 
        return { platformAccountId, username, accessToken, refreshToken, tokenExpiresAt };
 
      } catch (error) {
        console.error('Google OAuth Error:', error.response?.data || error.message);
        throw new Error(`Gagal authenticate dengan Google: ${error.response?.data?.error_description || error.message}`);
      }
    }
 
    // ─────────────────────────────────────────────
    // HELPER: TikTok OAuth
    // ─────────────────────────────────────────────
    async function handleTikTokOAuth(code, redirectUri) {
      const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
      const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
 
      try {
        // Tukar authorization code dengan access token
        // FIX: Content-Type harus x-www-form-urlencoded, bukan JSON
        const tokenResponse = await axios.post(
          'https://open.tiktokapis.com/v2/oauth/token/',
          new URLSearchParams({
            client_key: TIKTOK_CLIENT_KEY,
            client_secret: TIKTOK_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
 
        const accessToken = tokenResponse.data.access_token;
        const refreshToken = tokenResponse.data.refresh_token || null;
        const tokenExpiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);
 
        // Ambil informasi user TikTok
        const userResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            fields: 'open_id,union_id,display_name'
          }
        });
 
        if (!userResponse.data.data || !userResponse.data.data.user) {
          throw new Error('TikTok user information not found');
        }
 
        const user = userResponse.data.data.user;
        const platformAccountId = user.open_id;
        const username = user.display_name || `TikTok_${platformAccountId}`;
 
        return { platformAccountId, username, accessToken, refreshToken, tokenExpiresAt };
 
      } catch (error) {
        console.error('TikTok OAuth Error:', error.response?.data || error.message);
        throw new Error(`Gagal authenticate dengan TikTok: ${error.response?.data?.message || error.message}`);
      }
    }
 
    // ─────────────────────────────────────────────
    // 2. LOGIKA OAUTH PER PLATFORM
    // FIX: Destructure return value dari setiap helper
    // ─────────────────────────────────────────────
    let platformAccountId, username, accessToken, refreshToken, tokenExpiresAt;
 
    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
      case 'INSTAGRAM':
        ({ platformAccountId, username, accessToken, refreshToken, tokenExpiresAt }
          = await handleMetaOAuth(auth_code, REDIRECT_URI, platform));
        break;
 
      case 'YOUTUBE':
        ({ platformAccountId, username, accessToken, refreshToken, tokenExpiresAt }
          = await handleGoogleOAuth(auth_code, REDIRECT_URI));
        break;
 
      case 'TIKTOK':
        ({ platformAccountId, username, accessToken, refreshToken, tokenExpiresAt }
          = await handleTikTokOAuth(auth_code, REDIRECT_URI));
        break;
 
      default:
        return res.status(400).json({ status: 'error', message: `Platform ${platform} tidak didukung` });
    }
 
    // ─────────────────────────────────────────────
    // 3. SIMPAN ATAU PERBARUI KE DATABASE (UPSERT)
    // ─────────────────────────────────────────────
    const { data: existingAccount } = await supabase
      .from('connected_social_accounts')
      .select('id')
      .eq('creator_id', creator.id)
      .eq('platform', platform.toUpperCase())
      .maybeSingle();
 
    const accountData = {
      platform_account_id: platformAccountId,
      username: username,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      status: 'VERIFIED'
    };
 
    let savedAccount;
 
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
 
    return res.status(201).json({
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
    return res.status(500).json({
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
    const { page, limit, offset } = parsePagination(req.query);
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    if (!creator) return res.status(404).json({ status: 'error', message: 'Creator tidak ditemukan' });

    let query = supabase
      .from('creator_bank_accounts')
      .select('*', { count: 'exact' })
      .eq('creator_id', creator.id);

    // Apply is_primary filter
    if (req.query.is_primary !== undefined) {
      const isPrimary = req.query.is_primary === 'true';
      query = query.eq('is_primary', isPrimary);
    }

    // Apply bank_code filter
    if (req.query.bank_code) {
      query = query.eq('bank_code', req.query.bank_code.toUpperCase());
    }

    // Apply sorting
    const sortField = req.query.sort || '-is_primary';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];
    query = query.order(field, { ascending: direction === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    
    const response = formatPaginationResponse(data || [], count || 0, page, limit);
    res.status(200).json({ status: 'success', ...response });
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
