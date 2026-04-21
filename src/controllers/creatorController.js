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

// 2. CONNECT SOCIAL ACCOUNT
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
    let refreshToken = 'no_refresh_token_provided'; // Seringkali tidak diberikan di request awal
    let tokenExpiresAt = null;

    // [PENTING]: Ganti ini dengan kredensial dari dashboard Meta/Google
    const FB_APP_ID = process.env.FB_APP_ID || '996048352850896';
    const FB_APP_SECRET = process.env.FB_APP_SECRET || 'EAAOJ5pRAM9ABRZA2UZBZC1WQ8NtmZB4cWn5E7SIGorZCKwOEzicZAcFDmVJF7N3sa9EA9FXXEvIHIfH3WSng21jJK8MQ6sZCWPskkc5GD2BRiN45PdR0uMDMrE7ZCmRGY7RWZC2BLdhZC9yeF8RZBIN0t12ZAmNHBoxN7LgYiufdFkZCv8EZBOoBDPQDnpGNjbHsTUrZAvdVw3KvkSfGPreEowL19QyUUuyfZAZA4ZAm97qP6BTi73dhopgi3tvHMf3LGupRPOajyu5LbtgGVDTHf0tZABUTgOtjNLaGPvOZBSBzPGeQFSxZA2BgQAfxJjzOWXvSgx88r84O8GymQ1ZBBQiQZDZD';
    const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback'; // Harus persis sama dengan yang dikirim frontend

    // 2. LOGIKA OAUTH PER PLATFORM
    switch (platform.toUpperCase()) {
      case 'FACEBOOK':
      case 'INSTAGRAM':
        try {
            // Karena Token MOCK yang Anda kirim (EAAX...) terlalu panjang, kita asumsikan itu adalah
            // token yang didapat dari halaman OAuthCallback (Short-Lived Access Token).
            // Dalam flow OAuth sebenarnya, auth_code adalah kode pendek yang ditukar di sini.
            
            // JIKA auth_code ADALAH SHORT-LIVED ACCESS TOKEN (Client-side login):
            // (Untuk pengembangan, kita gunakan token yang Anda kirim langsung)
            accessToken = auth_code; 
            
            // [ALUR SEBENARNYA JIKA auth_code ADALAH AUTHORIZATION CODE (Server-side login)]:
            /*
            const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
                params: {
                    client_id: FB_APP_ID,
                    redirect_uri: REDIRECT_URI,
                    client_secret: FB_APP_SECRET,
                    code: auth_code
                }
            });
            accessToken = tokenResponse.data.access_token;
            */

            // Ambil Profil Dasar menggunakan Graph API
            const profileResponse = await axios.get(`https://graph.facebook.com/me`, {
                params: {
                    fields: 'id,name',
                    access_token: accessToken
                }
            });

            platformAccountId = profileResponse.data.id;
            
            // Beri nama berbeda agar terlihat di UI
            if (platform.toUpperCase() === 'FACEBOOK') {
                username = profileResponse.data.name || `User_${platformAccountId}`;
            } else {
                 username = `${profileResponse.data.name}_ig` || `IG_${platformAccountId}`;
                 // [Catatan]: Untuk Instagram yang sebenarnya, Anda harus query ke node /me/accounts 
                 // lalu ke node Instagram Business Account. Ini hanya contoh Graph API dasar.
            }

            // Set expiry time (Contoh: 60 hari untuk Long-Lived Token Facebook)
            tokenExpiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);

        } catch (error) {
            console.error("Meta Graph API Error:", error.response ? error.response.data : error.message);
            // Fallback untuk testing jika token Anda invalid/expired
            platformAccountId = `MOCK_${platform}_${Date.now()}`;
            username = `MockUser_${platform}`;
            accessToken = auth_code;
            console.log("Menggunakan fallback mock karena token Graph API gagal.");
        }
        break;

      case 'YOUTUBE':
         // ... (Logika pertukaran token Google)
         platformAccountId = `YT_${Date.now()}`;
         username = `Channel_YT_${Math.floor(Math.random() * 9999)}`;
         accessToken = auth_code;
         break;

      case 'TIKTOK':
         // ... (Logika pertukaran token TikTok)
         platformAccountId = `TK_${Date.now()}`;
         username = `tiktok_user_${Math.floor(Math.random() * 9999)}`;
         accessToken = auth_code;
         break;

      default:
        return res.status(400).json({ status: 'error', message: `Platform ${platform} tidak didukung` });
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
    res.status(500).json({ status: 'error', message: 'Gagal menghubungkan akun sosial media' });
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


module.exports = { submitKYC, connectSocialAccount, registerBankAccount, setup2FA, verify2FA, getProfile };
