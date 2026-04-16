const supabase = require('../config/supabase');

// Helper: Ambil data creator spesifik berdasarkan user_id di JWT Token
const getCreatorByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('Data Creator tidak ditemukan di sistem.');
  return data;
};

// 2.1 Submit KYC
exports.submitKyc = async (req, res) => {
  try {
    const { nik, npwp, ktp_image_url, selfie_image_url } = req.body;
    
    // req.user disuntikkan oleh authMiddleware (protect)
    const userId = req.user.user_id || req.user.id; 

    const creator = await getCreatorByUserId(userId);

    // Update status KYC di database
    const { data: updatedCreator, error } = await supabase
      .from('creators')
      .update({
        nik,
        npwp,
        kyc_status: 'PENDING'
        // Jika perlu menyimpan URL gambar, pastikan kolomnya sudah ada di DB Anda
        // ktp_image_url, 
        // selfie_image_url
      })
      .eq('id', creator.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(202).json({
      status: 'success',
      message: 'Data KYC diterima dan sedang diproses (PENDING)',
      data: {
        kyc_status: updatedCreator.kyc_status
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// 2.2 Hubungkan Akun Sosial Media (Mock OAuth)
exports.connectSocialAccount = async (req, res) => {
  try {
    const { platform, auth_code, redirect_uri } = req.body;
    const userId = req.user.user_id || req.user.id;

    const creator = await getCreatorByUserId(userId);

    // MOCK-UP RESPONSE: Karena integrasi API OAuth asli membutuhkan credentials
    const mockPlatformAccountId = `UC_${Math.random().toString(36).substr(2, 10).toUpperCase()}`;
    const mockUsername = `${platform || 'YOUTUBE'}_User_${Math.floor(Math.random() * 1000)}`;

    const { data, error } = await supabase
      .from('connected_social_accounts')
      .insert([{
        creator_id: creator.id,
        platform: platform || 'YOUTUBE',
        platform_account_id: mockPlatformAccountId,
        username: mockUsername,
        status: 'VERIFIED',
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Akun sosial media ini sudah pernah dihubungkan.');
      throw error;
    }

    return res.status(201).json({
      status: 'success',
      message: `Akun ${platform || 'YouTube'} berhasil dihubungkan`,
      data: {
        connected_account_id: data.id,
        platform: data.platform,
        platform_account_id: data.platform_account_id,
        username: data.username,
        status: data.status
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// 2.3 Daftarkan Rekening Bank
exports.registerBankAccount = async (req, res) => {
  try {
    const { bank_code, account_number, account_name } = req.body;
    const userId = req.user.user_id || req.user.id;

    const creator = await getCreatorByUserId(userId);

    // Validasi KYC: Sesuai instruksi PRD
    if (creator.kyc_status !== 'VERIFIED') {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak. Anda harus menyelesaikan verifikasi KYC terlebih dahulu untuk mendaftarkan rekening bank.'
      });
    }

    const { data, error } = await supabase
      .from('creator_bank_accounts')
      .insert([{
        creator_id: creator.id,
        bank_code: bank_code,
        account_number: account_number,
        account_name: account_name,
        status: 'PENDING'
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: 'success',
      data: {
        bank_account_id: data.id,
        status: data.status === 'PENDING' ? 'PENDING_VERIFICATION' : data.status
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};