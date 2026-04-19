const supabase = require('../config/supabase');
const { snap } = require('../utils/midtrans');

// Fungsi Helper untuk Upload ke Supabase Storage
const uploadToSupabaseStorage = async (file) => {
  // Buat nama file unik
  const fileName = `assets/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
  
  const { data, error } = await supabase.storage
    .from('campaign-assets') // Ganti dengan nama bucket Anda di Supabase
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) throw error;

  // Dapatkan Public URL
  const { data: publicUrlData } = supabase.storage
    .from('campaign-assets')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};

// 1. CREATE CAMPAIGN
const createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    // req.body sekarang hanya berisi teks. req.files berisi file fisik.
    const { 
      nama_campaign, budget_total, daily_spend_limit, platform, 
      komisi_per_view, min_watch_duration, max_submission_per_creator,
      tanggal_mulai, tanggal_berakhir 
    } = req.body;

    // --- PROSES UPLOAD FILE FISIK ---
    let uploadedAssetUrls = [];
    if (req.files && req.files.length > 0) {
      // Jalankan upload secara paralel
      const uploadPromises = req.files.map(file => uploadToSupabaseStorage(file));
      uploadedAssetUrls = await Promise.all(uploadPromises);
    }

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert([{
        brand_id: brand.id,
        nama_campaign,
        budget_total,
        budget_tersisa: 0,
        daily_spend_limit,
        platform,
        komisi_per_view,
        min_watch_duration,
        max_submission_per_creator,
        tanggal_mulai,
        tanggal_berakhir,
        asset_urls: uploadedAssetUrls, // [UPDATE] Array URL dari Storage
        status: 'DRAFT'
      }])
      .select().single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      data: { campaign_id: campaign.campaign_id, status: campaign.status, assets: uploadedAssetUrls }
    });

  } catch (error) {
    console.error('Create Campaign Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal membuat campaign' });
  }
};

// 1.B UPDATE CAMPAIGN (Dukungan File Baru & URL Lama)
const updateCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.id;
    
    // existing_asset_urls adalah array URL lama yang tidak dihapus oleh user di Frontend
    const { 
      nama_campaign, daily_spend_limit, platform, 
      komisi_per_view, min_watch_duration, max_submission_per_creator,
      tanggal_mulai, tanggal_berakhir,
      existing_asset_urls 
    } = req.body;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brand) return res.status(403).json({ message: 'Akses ditolak' });

    // Parse existing urls (karena dikirim via FormData, array bisa berupa string JSON)
    let finalAssetUrls = [];
    if (existing_asset_urls) {
       finalAssetUrls = Array.isArray(existing_asset_urls) ? existing_asset_urls : JSON.parse(existing_asset_urls);
    }

    // --- PROSES UPLOAD FILE BARU (Jika ada penambahan) ---
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToSupabaseStorage(file));
      const newUploadedUrls = await Promise.all(uploadPromises);
      finalAssetUrls = [...finalAssetUrls, ...newUploadedUrls]; // Gabung URL lama + URL baru
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ 
        nama_campaign, daily_spend_limit, platform, komisi_per_view,
        min_watch_duration, max_submission_per_creator, tanggal_mulai, tanggal_berakhir,
        asset_urls: finalAssetUrls
      })
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .select().single();

    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Campaign diperbarui', data: campaign });

  } catch (error) {
    console.error('Update Campaign Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui campaign' });
  }
};


// 2. TOP UP BUDGET (Midtrans Snap)
const topupBudget = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;

    // Verify campaign ownership
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .single();

    if (!campaign) return res.status(404).json({ message: 'Campaign tidak ditemukan atau bukan milik Anda' });

    const orderId = `TOPUP-${campaign_id.slice(0,8)}-${Date.now()}`;

    // Create Midtrans Transaction
    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      credit_card: { secure: true },
      customer_details: {
        email: req.user.email
      }
    };

    const transaction = await snap.createTransaction(parameter);

// Save transaction to DB
    await supabase.from('topup_transactions').insert([{
      campaign_id,
      order_id: orderId,
      gross_amount: amount,
      snap_token: transaction.token,
      status: 'PENDING'
    }]);

    res.status(200).json({
      status: 'success',
      data: {
        order_id: orderId,
        snap_token: transaction.token,
        redirect_url: transaction.redirect_url
      }
    });

  } catch (error) {
    console.error('Topup Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal memproses Top-up' });
  }
};

// 3. UPDATE STATUS CAMPAIGN
const updateCampaignStatus = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { status } = req.body; // e.g., 'DIJEDA', 'AKTIF', 'DIBATALKAN'
    const userId = req.user.id;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brand) return res.status(403).json({ message: 'Akses ditolak' });

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .select().single();

    if (error || !campaign) throw error;

    res.status(200).json({ status: 'success', message: 'Status berhasil diubah', data: campaign });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal merubah status' });
  }
};

// 4. UPDATE DAILY LIMIT
const updateCampaignLimit = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { daily_spend_limit } = req.body;
    const userId = req.user.id;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ daily_spend_limit })
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .select().single();

    if (error || !campaign) throw error;

    res.status(200).json({ status: 'success', message: 'Limit berhasil diubah', data: campaign });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal merubah limit' });
  }
};

// 5. CLAIM REFUND
const claimRefund = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.id;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .single();

    // Validasi
    if (campaign.status !== 'DIBATALKAN' && campaign.status !== 'SELESAI_WAKTU') {
        return res.status(400).json({ message: 'Hanya bisa refund untuk campaign yg dibatalkan/selesai' });
    }
    if (campaign.budget_tersisa <= 0) {
        return res.status(400).json({ message: 'Tidak ada dana untuk di-refund' });
    }

    const amountRefunded = campaign.budget_tersisa;

    // Zero out the remaining budget
    await supabase.from('campaigns').update({ budget_tersisa: 0 }).eq('campaign_id', campaign.campaign_id);

    // Here we would trigger Finance ops or directly refund via Midtrans if supported.
    // For MVP, we log it.
    res.status(200).json({ 
        status: 'success', 
        message: 'Refund diajukan ke tim Finance', 
        amount: amountRefunded 
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal memproses refund' });
  }
};

// 6. ANALYTICS
const getCampaignAnalytics = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { data: campaign } = await supabase.from('campaigns').select('*').eq('campaign_id', campaign_id).single();

    const { data: subs } = await supabase.from('submissions').select('views_tervalidasi, gross_earning').eq('campaign_id', campaign_id);
    
    let views = subs.reduce((a, b) => a + (b.views_tervalidasi || 0), 0);
    let spending = subs.reduce((a, b) => a + (b.gross_earning || 0), 0);
    let cpv = views > 0 ? (spending / views).toFixed(2) : 0;

    res.status(200).json({
        status: 'success',
        data: {
           campaign_id: campaign.campaign_id,
           total_views: views,
           total_spending: spending,
           effective_cpv: cpv
        }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal menganalisa' });
  }
};

// 7. EXPLORE CAMPAIGNS (For Creators)
const exploreCampaigns = async (req, res) => {
  try {
    const { platform } = req.query; // optional filter
    let query = supabase.from('campaigns').select('*').eq('status', 'AKTIF');
    
    if (platform) {
        query = query.eq('platform', platform);
    }
    
    const { data: campaigns, error } = await query;
    if (error) throw error;

    res.status(200).json({ status: 'success', data: campaigns });
  } catch (error) {
     res.status(500).json({ status: 'error', message: 'Gagal mengambil data eksplorasi' });
  }
};

const getBrandCampaigns = async (req, res) => {
  try {
    const userId = req.user.id; // Diambil dari JWT token via authMiddleware

    // 1. Dapatkan ID Brand berdasarkan user_id
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return res.status(404).json({ status: 'error', message: 'Profil Brand tidak ditemukan' });
    }

    // 2. Ambil semua campaign yang dibuat oleh Brand ini
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false }); // Urutkan dari yang terbaru (opsional, jika Anda punya kolom created_at)

    if (campaignError) throw campaignError;

    res.status(200).json({
      status: 'success',
      message: 'Berhasil mengambil daftar campaign',
      data: campaigns
    });
  } catch (error) {
    console.error('Error getting brand campaigns:', error);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server saat mengambil campaign' });
  }
};

module.exports = { 
  createCampaign, 
  updateCampaign,
  topupBudget, 
  updateCampaignStatus, 
  updateCampaignLimit, 
  claimRefund, 
  getCampaignAnalytics, 
  exploreCampaigns,
  getBrandCampaigns
};