// --- src/controllers/brandController.js ---
const supabase = require('../config/supabase');

// Fungsi Helper untuk Upload ke Supabase Storage
const uploadToSupabaseStorage = async (file) => {
  const fileName = `profiles/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
  
  const { data, error } = await supabase.storage
    .from('campaign-assets')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from('campaign-assets')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    
    const { data: brand, error } = await supabase
      .from('brands')
      .select(`
        nama_perusahaan, pic_name, phone_number, logo_url,
        website, alamat, kota, provinsi, kode_pos, 
        industri, ukuran_perusahaan, deskripsi, tahun_berdiri,
        users (email, status, phone_number, profile_completed)
      `)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: brand
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil profil brand' });
  }
};

// 1. UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { validateBrandProfile, formatPhoneNumber, formatWebsite } = require('../utils/profileValidation');
    
    const userId = req.user.user_id || req.user.id;
    const { 
      nama_perusahaan, pic_name, phone_number, 
      website, alamat, kota, provinsi, kode_pos,
      industri, ukuran_perusahaan, deskripsi, tahun_berdiri
    } = req.body;
    let logo_url = req.body.logo_url;

    const validation = validateBrandProfile({
      nama_perusahaan,
      pic_name,
      phone_number,
      website,
      tahun_berdiri,
      kode_pos
    });

    if (!validation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: validation.errors
      });
    }

    if (req.file) {
      logo_url = await uploadToSupabaseStorage(req.file);
    }

    const updateData = {};
    if (nama_perusahaan !== undefined) updateData.nama_perusahaan = nama_perusahaan;
    if (pic_name !== undefined) updateData.pic_name = pic_name;
    if (phone_number !== undefined) updateData.phone_number = formatPhoneNumber(phone_number);
    if (website !== undefined) updateData.website = formatWebsite(website);
    if (alamat !== undefined) updateData.alamat = alamat;
    if (kota !== undefined) updateData.kota = kota;
    if (provinsi !== undefined) updateData.provinsi = provinsi;
    if (kode_pos !== undefined) updateData.kode_pos = kode_pos;
    if (industri !== undefined) updateData.industri = industri;
    if (ukuran_perusahaan !== undefined) updateData.ukuran_perusahaan = ukuran_perusahaan;
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi;
    if (tahun_berdiri !== undefined) updateData.tahun_berdiri = parseInt(tahun_berdiri);
    if (logo_url !== undefined) updateData.logo_url = logo_url;

    const { data: brand, error } = await supabase
      .from('brands')
      .update(updateData)
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    if (!brand || brand.length === 0) {
      throw new Error('Profil Brand tidak ditemukan di database.');
    }

    res.status(200).json({
      status: 'success',
      message: 'Profil berhasil diupdate',
      data: brand[0]
    });

  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal mengupdate profil brand' });
  }
};

// 2. GET DASHBOARD
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();

    // Dapatkan semua kampanye Brand ini
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('campaign_id, budget_total, budget_tersisa, budget_terpakai, daily_spent_today, status')
      .eq('brand_id', brand.id);

    if (!campaigns || campaigns.length === 0) {
        return res.status(200).json({ status: 'success', data: { total_campaigns: 0, campaigns: [] } });
    }

    const campaignIds = campaigns.map(c => c.campaign_id);

    // Dapatkan total submission dan views
    const { data: submissions } = await supabase
      .from('submissions')
      .select('status, views_tervalidasi, estimasi_komisi')
      .in('campaign_id', campaignIds);

    let totalSubmissions = submissions.length;
    let totalViews = submissions.reduce((acc, sub) => acc + sub.views_tervalidasi, 0);

    // Hitung aggregasi budgeting
    let totalBudget = campaigns.reduce((acc, c) => acc + c.budget_total, 0);
    let totalSpent = campaigns.reduce((acc, c) => acc + c.budget_terpakai, 0);

    res.status(200).json({
        status: 'success',
        data: {
            total_campaigns: campaigns.length,
            total_submissions: totalSubmissions,
            total_views_tervalidasi: totalViews,
            total_budget: totalBudget,
            total_terpakai: totalSpent,
            campaign_details: campaigns
        }
    });

  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data dashboard' });
  }
};

module.exports = { getProfile, updateProfile, getDashboard };