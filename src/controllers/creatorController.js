const supabase = require('../config/supabase');
const speakeasy = require('speakeasy');

// 1. SUBMIT KYC
const submitKYC = async (req, res) => {
  try {
    const { nik, npwp, ktp_image_url, selfie_image_url } = req.body;
    const userId = req.user.id;

    // Ambil creator_id dari user_id
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (creatorError || !creator) {
      return res.status(404).json({ status: 'error', message: 'Profil Creator tidak ditemukan' });
    }

    const { error: updateError } = await supabase
      .from('creators')
      .update({
        nik,
        npwp,
        ktp_image_url,
        selfie_image_url,
        kyc_status: 'PENDING'
      })
      .eq('id', creator.id);

    if (updateError) throw updateError;

    res.status(202).json({
      status: 'success',
      message: 'Data KYC diterima dan sedang diproses (PENDING)',
      data: { kyc_status: 'PENDING' }
    });

  } catch (error) {
    console.error('KYC Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// 2. CONNECT SOCIAL ACCOUNT
const connectSocialAccount = async (req, res) => {
  try {
    const { platform, auth_code } = req.body;
    const userId = req.user.id;

    // Mock logic for OAuth validation (in real app, use platform SDK)
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();

    const { data: socialAcc, error } = await supabase
      .from('connected_social_accounts')
      .insert([{
        creator_id: creator.id,
        platform,
        platform_account_id: `MOCK_ID_${Date.now()}`,
        username: `Creator_${platform}`,
        status: 'VERIFIED'
      }])
      .select().single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      message: `Akun ${platform} berhasil dihubungkan`,
      data: {
        connected_account_id: socialAcc.id,
        platform: socialAcc.platform,
        platform_account_id: socialAcc.platform_account_id,
        username: socialAcc.username,
        status: 'VERIFIED'
      }
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal menghubungkan akun sosial' });
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


module.exports = { submitKYC, connectSocialAccount, registerBankAccount, setup2FA, verify2FA };
