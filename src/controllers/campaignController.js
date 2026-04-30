const supabase = require('../config/supabase');
const { snap } = require('../utils/midtrans');
const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');

// Fungsi Helper untuk Upload ke Supabase Storage
const uploadToSupabaseStorage = async (file) => {
  const fileName = `assets/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
  
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

// 1. CREATE CAMPAIGN
const createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      nama_campaign, budget_total, daily_spend_limit, platform, 
      komisi_per_view, min_watch_duration, max_submission_per_creator,
      tanggal_mulai, tanggal_berakhir, min_konten_diterima
    } = req.body;

    let uploadedAssetUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToSupabaseStorage(file));
      uploadedAssetUrls = await Promise.all(uploadPromises);
    }

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brand) return res.status(404).json({ status: 'error', message: 'Profil Brand tidak ditemukan' });

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert([{
        brand_id: brand.id,
        nama_campaign,
        budget_total: budget_total || 0,
        budget_tersisa: 0,
        daily_spend_limit,
        platform,
        komisi_per_view,
        min_watch_duration,
        max_submission_per_creator,
        min_konten_diterima: min_konten_diterima || 0,
        tanggal_mulai,
        tanggal_berakhir,
        asset_urls: uploadedAssetUrls,
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

// 1.B UPDATE CAMPAIGN
const updateCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.id;
    
    const { 
      nama_campaign, daily_spend_limit, platform, 
      komisi_per_view, min_watch_duration, max_submission_per_creator,
      tanggal_mulai, tanggal_berakhir, min_konten_diterima,
      existing_asset_urls 
    } = req.body;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brand) return res.status(403).json({ message: 'Akses ditolak' });

    let finalAssetUrls = [];
    if (existing_asset_urls) {
       finalAssetUrls = Array.isArray(existing_asset_urls) ? existing_asset_urls : JSON.parse(existing_asset_urls);
    }

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToSupabaseStorage(file));
      const newUploadedUrls = await Promise.all(uploadPromises);
      finalAssetUrls = [...finalAssetUrls, ...newUploadedUrls];
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ 
        nama_campaign, daily_spend_limit, platform, komisi_per_view,
        min_watch_duration, max_submission_per_creator, tanggal_mulai, tanggal_berakhir,
        min_konten_diterima: min_konten_diterima !== undefined ? parseInt(min_konten_diterima) : undefined,
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

// 2. TOP UP BUDGET
const topupBudget = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .single();

    if (!campaign) return res.status(404).json({ message: 'Campaign tidak ditemukan atau bukan milik Anda' });

    const orderId = `TOPUP-${campaign_id.slice(0,8)}-${Date.now()}`;

    let parameter = {
      transaction_details: { order_id: orderId, gross_amount: amount },
      credit_card: { secure: true },
      customer_details: { email: req.user.email }
    };

    const transaction = await snap.createTransaction(parameter);

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

const crypto = require('crypto');

// 2.B MIDTRANS WEBHOOK HANDLER
const handleMidtransNotification = async (req, res) => {
  try {
    const data = req.body;

    // 1. Validasi Keamanan (Signature Key)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const hash = crypto.createHash('sha512')
      .update(`${data.order_id}${data.status_code}${data.gross_amount}${serverKey}`)
      .digest('hex');

    if (data.signature_key !== hash) {
      return res.status(403).json({ status: 'error', message: 'Invalid signature key' });
    }

    const transactionStatus = data.transaction_status;
    const fraudStatus = data.fraud_status;
    const orderId = data.order_id;

    // 2. Tentukan Status Akhir Berdasarkan Response Midtrans
    let finalStatus = 'PENDING';
    if (transactionStatus == 'capture') {
        if (fraudStatus == 'challenge') finalStatus = 'CHALLENGE';
        else if (fraudStatus == 'accept') finalStatus = 'SUCCESS';
    } else if (transactionStatus == 'settlement') {
        finalStatus = 'SUCCESS';
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
        finalStatus = 'FAILED';
    }

    // 3. Cari Transaksi di Database
    const { data: topupData, error: findError } = await supabase
        .from('topup_transactions')
        .select('*')
        .eq('order_id', orderId)
        .single();

    if (findError || !topupData) {
        return res.status(404).json({ message: 'Transaction not found' });
    }

    // Cegah proses berulang jika transaksi sudah pernah di-set sukses sebelumnya
    if (topupData.status === 'SUCCESS') {
        return res.status(200).json({ message: 'Transaction already processed' });
    }

    // 4. Update Status Transaksi di Tabel topup_transactions
    await supabase.from('topup_transactions')
        .update({ status: finalStatus })
        .eq('order_id', orderId);

    // 5. Eksekusi Logika Bisnis Jika Pembayaran Sukses
    if (finalStatus === 'SUCCESS') {
        // Ambil data campaign saat ini
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('budget_total, budget_tersisa')
            .eq('campaign_id', topupData.campaign_id)
            .single();

        // Kalkulasi budget baru
        const newBudgetTotal = Number(campaign.budget_total) + Number(data.gross_amount);
        const newBudgetTersisa = Number(campaign.budget_tersisa) + Number(data.gross_amount);

        // Update campaign: tambah saldo dan ubah status jadi AKTIF
        await supabase.from('campaigns')
            .update({
                budget_total: newBudgetTotal,
                budget_tersisa: newBudgetTersisa,
                status: 'AKTIF' 
            })
            .eq('campaign_id', topupData.campaign_id);
    }

    // 6. WAJIB: Balas Midtrans dengan 200 OK agar mereka tidak mengulang notifikasi
    res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Midtrans Webhook Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// 3. UPDATE STATUS CAMPAIGN
const updateCampaignStatus = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brand) return res.status(403).json({ message: 'Akses ditolak' });

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .select().single();

    if (error || !campaign) throw error || new Error('Campaign tidak ditemukan');

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

    if (error || !campaign) throw error || new Error('Campaign tidak ditemukan');

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

    if (campaign.status !== 'DIBATALKAN' && campaign.status !== 'SELESAI_WAKTU') {
        return res.status(400).json({ message: 'Hanya bisa refund untuk campaign yg dibatalkan/selesai' });
    }
    if (campaign.budget_tersisa <= 0) {
        return res.status(400).json({ message: 'Tidak ada dana untuk di-refund' });
    }

    const amountRefunded = campaign.budget_tersisa;
    await supabase.from('campaigns').update({ budget_tersisa: 0 }).eq('campaign_id', campaign.campaign_id);

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
/**
 * Explore campaigns dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: nama_campaign, brand name
 * @query {string} platform - Filter: INSTAGRAM, TIKTOK, YOUTUBE
 * @query {string} status - Filter: AKTIF, DRAFT, SELESAI
 * @query {number} budget_min - Filter minimum budget
 * @query {number} budget_max - Filter maximum budget
 * @query {string} sort - Sort: created_at, -created_at, budget_total, -budget_total
 */
const exploreCampaigns = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const { page, limit, offset } = parsePagination(req.query);
    const searchTerm = req.query.search ? req.query.search.trim() : '';
    const allowedFilters = ['platform', 'status'];
    const filters = parseFilters(req.query, allowedFilters);

    let query = supabase
      .from('campaigns')
      .select('campaign_id, nama_campaign, platform, status, budget_total, komisi_per_view, tanggal_berakhir, created_at, brands(nama_perusahaan)', { count: 'exact' })
      .eq('status', 'AKTIF');
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    // Apply search (nama_campaign)
    if (searchTerm) {
      query = query.ilike('nama_campaign', `%${searchTerm}%`);
    }

    // Apply budget range filters
    if (req.query.budget_min) {
      query = query.gte('budget_total', parseFloat(req.query.budget_min));
    }
    if (req.query.budget_max) {
      query = query.lte('budget_total', parseFloat(req.query.budget_max));
    }

    // Apply sorting
    const sortField = req.query.sort || '-created_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];
    query = query.order(field, { ascending: direction === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: campaigns, error, count } = await query;
    if (error) throw error;

    // Ambil campaign yang sudah di-join creator ini
    let joinedIds = new Set();
    try {
      const creator = await supabase.from('creators').select('id').eq('user_id', userId).maybeSingle();
      if (creator.data) {
        const { data: joined } = await supabase
          .from('campaign_participants')
          .select('campaign_id')
          .eq('creator_id', creator.data.id);
        joinedIds = new Set((joined || []).map(j => j.campaign_id));
      }
    } catch (_) {}

    const result = (campaigns || []).map(c => ({
      ...c,
      brand_name: Array.isArray(c.brands) ? c.brands[0]?.nama_perusahaan : c.brands?.nama_perusahaan,
      is_joined: joinedIds.has(c.campaign_id)
    }));

    const response = formatPaginationResponse(result, count || 0, page, limit);
    res.status(200).json({ status: 'success', ...response });
  } catch (error) {
    console.error('Explore Campaigns Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data eksplorasi' });
  }
};

// 8. GET BRAND CAMPAIGNS
const getBrandCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return res.status(404).json({ status: 'error', message: 'Profil Brand tidak ditemukan' });
    }

    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    if (campaignError) throw campaignError;

    res.status(200).json({
      status: 'success',
      message: 'Berhasil mengambil daftar campaign',
      data: campaigns
    });
  } catch (error) {
    console.error('Error getting brand campaigns:', error);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};

// 9. JOIN CAMPAIGN (Creator)
const joinCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.user_id || req.user.id;

    // Cari creator
    const { data: creator, error: creatorErr } = await supabase
      .from('creators')
      .select('id, kyc_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (creatorErr || !creator) {
      return res.status(404).json({ status: 'error', message: 'Profil Creator tidak ditemukan' });
    }

    // Cek campaign exist dan AKTIF
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('campaign_id, status, nama_campaign')
      .eq('campaign_id', campaign_id)
      .maybeSingle();

    if (campErr || !campaign) {
      return res.status(404).json({ status: 'error', message: 'Campaign tidak ditemukan' });
    }

    if (campaign.status !== 'AKTIF') {
      return res.status(400).json({ status: 'error', message: `Campaign ini berstatus ${campaign.status}, tidak bisa bergabung.` });
    }

    // Cek apakah sudah join
    const { data: existing } = await supabase
      .from('campaign_participants')
      .select('id')
      .eq('campaign_id', campaign_id)
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ status: 'error', message: 'Anda sudah bergabung dengan campaign ini.' });
    }

    // Insert ke campaign_participants
    const { data: participant, error: joinErr } = await supabase
      .from('campaign_participants')
      .insert([{
        campaign_id,
        creator_id: creator.id,
        joined_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (joinErr) {
      if (joinErr.code === '23505') {
        return res.status(409).json({ status: 'error', message: 'Anda sudah bergabung dengan campaign ini.' });
      }
      throw joinErr;
    }

    res.status(201).json({
      status: 'success',
      message: `Berhasil bergabung dengan campaign "${campaign.nama_campaign}"!`,
      data: participant
    });

  } catch (error) {
    console.error('Join Campaign Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal bergabung dengan campaign' });
  }
};

// 10. GET CAMPAIGN PARTICIPANTS (Brand)
/**
 * Get campaign participants dengan pagination, filter, dan search
 * @param {string} campaign_id - Campaign ID
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: nama_lengkap, email
 * @query {string} kyc_status - Filter: PENDING, VERIFIED, REJECTED
 * @query {number} submission_count_min - Filter minimum submission count
 * @query {number} submission_count_max - Filter maximum submission count
 * @query {string} sort - Sort: joined_at, -joined_at, submission_count, -submission_count
 */
const getCampaignParticipants = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.id;
    const { page, limit, offset } = parsePagination(req.query);
    const searchTerm = req.query.search ? req.query.search.trim() : '';

    // Verifikasi ownership
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brand) return res.status(403).json({ status: 'error', message: 'Akses ditolak' });

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('campaign_id, nama_campaign, brand_id')
      .eq('campaign_id', campaign_id)
      .eq('brand_id', brand.id)
      .maybeSingle();

    if (!campaign) return res.status(403).json({ status: 'error', message: 'Campaign tidak ditemukan atau bukan milik Anda' });

    // Ambil peserta dengan count untuk pagination
    let participantQuery = supabase
      .from('campaign_participants')
      .select(`
        id,
        joined_at,
        creators (
          id,
          nama_lengkap,
          kyc_status,
          users ( email )
        )
      `, { count: 'exact' })
      .eq('campaign_id', campaign_id);

    const { data: participants, error: partErr, count: totalParticipants } = await participantQuery;
    if (partErr) throw partErr;

    // Ambil submission count per creator untuk campaign ini
    const { data: submissions } = await supabase
      .from('submissions')
      .select('creator_id, status, views_tervalidasi, net_earning')
      .eq('campaign_id', campaign_id);

    // Group submissions by creator_id
    const submissionsByCreator = {};
    (submissions || []).forEach(s => {
      if (!submissionsByCreator[s.creator_id]) {
        submissionsByCreator[s.creator_id] = { count: 0, views: 0, earning: 0, latest_status: '' };
      }
      submissionsByCreator[s.creator_id].count++;
      submissionsByCreator[s.creator_id].views += (s.views_tervalidasi || 0);
      submissionsByCreator[s.creator_id].earning += (s.net_earning || 0);
      submissionsByCreator[s.creator_id].latest_status = s.status;
    });

    let result = (participants || []).map(p => {
      const creatorData = Array.isArray(p.creators) ? p.creators[0] : p.creators;
      const stats = submissionsByCreator[creatorData?.id] || { count: 0, views: 0, earning: 0, latest_status: '-' };
      return {
        participant_id: p.id,
        joined_at: p.joined_at,
        creator_id: creatorData?.id,
        nama_lengkap: creatorData?.nama_lengkap || '-',
        email: (Array.isArray(creatorData?.users) ? creatorData?.users[0] : creatorData?.users)?.email || '-',
        kyc_status: creatorData?.kyc_status || '-',
        submission_count: stats.count,
        total_views: stats.views,
        total_earning: stats.earning,
        latest_submission_status: stats.latest_status
      };
    });

    // Apply search filter
    if (searchTerm) {
      result = result.filter(r => 
        r.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply kyc_status filter
    if (req.query.kyc_status) {
      result = result.filter(r => r.kyc_status === req.query.kyc_status);
    }

    // Apply submission count range filters
    if (req.query.submission_count_min) {
      result = result.filter(r => r.submission_count >= parseInt(req.query.submission_count_min));
    }
    if (req.query.submission_count_max) {
      result = result.filter(r => r.submission_count <= parseInt(req.query.submission_count_max));
    }

    // Apply sorting
    const sortField = req.query.sort || '-joined_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];
    
    result.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Apply pagination
    const paginatedResult = result.slice(offset, offset + limit);

    res.status(200).json({
      status: 'success',
      data: {
        campaign_id,
        campaign_name: campaign.nama_campaign,
        total_participants: result.length,
        participants: paginatedResult
      },
      pagination: {
        current_page: page,
        per_page: limit,
        total_items: result.length,
        total_pages: Math.ceil(result.length / limit),
        has_next: page < Math.ceil(result.length / limit),
        has_prev: page > 1
      }
    });

  } catch (error) {
    console.error('Get Participants Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data peserta' });
  }
};

// 11. GET MY JOINED CAMPAIGNS (Creator)
/**
 * Get creator's joined campaigns dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: nama_campaign, platform, brand_name
 * @query {string} platform - Filter: INSTAGRAM, TIKTOK, YOUTUBE
 * @query {string} status - Filter: AKTIF, DRAFT, SELESAI
 * @query {string} sort - Sort: joined_at, -joined_at, total_earning, -total_earning
 */
const getMyCampaigns = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const { page, limit, offset } = parsePagination(req.query);
    const searchTerm = req.query.search ? req.query.search.trim() : '';

    const { data: creator, error: creatorErr } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (creatorErr || !creator) {
      return res.status(404).json({ status: 'error', message: 'Profil Creator tidak ditemukan' });
    }

    const { data: participants, error: partErr } = await supabase
      .from('campaign_participants')
      .select(`
        joined_at,
        campaigns (
          campaign_id,
          nama_campaign,
          platform,
          status,
          komisi_per_view,
          tanggal_berakhir,
          min_konten_diterima,
          brands ( nama_perusahaan )
        )
      `)
      .eq('creator_id', creator.id)
      .order('joined_at', { ascending: false });

    if (partErr) throw partErr;

    // Hitung submission count per campaign
    const campaignIds = (participants || []).map(p => {
      const camp = Array.isArray(p.campaigns) ? p.campaigns[0] : p.campaigns;
      return camp?.campaign_id;
    }).filter(Boolean);

    let submissionStats = {};
    if (campaignIds.length > 0) {
      const { data: subs } = await supabase
        .from('submissions')
        .select('campaign_id, status, views_tervalidasi, net_earning')
        .eq('creator_id', creator.id)
        .in('campaign_id', campaignIds);

      (subs || []).forEach(s => {
        if (!submissionStats[s.campaign_id]) {
          submissionStats[s.campaign_id] = { count: 0, views: 0, earning: 0 };
        }
        submissionStats[s.campaign_id].count++;
        submissionStats[s.campaign_id].views += (s.views_tervalidasi || 0);
        submissionStats[s.campaign_id].earning += (s.net_earning || 0);
      });
    }

    let result = (participants || []).map(p => {
      const camp = Array.isArray(p.campaigns) ? p.campaigns[0] : p.campaigns;
      const brand = Array.isArray(camp?.brands) ? camp?.brands[0] : camp?.brands;
      const stats = submissionStats[camp?.campaign_id] || { count: 0, views: 0, earning: 0 };

      return {
        campaign_id: camp?.campaign_id,
        nama_campaign: camp?.nama_campaign,
        platform: camp?.platform,
        status: camp?.status,
        komisi_per_view: camp?.komisi_per_view,
        tanggal_berakhir: camp?.tanggal_berakhir,
        min_konten_diterima: camp?.min_konten_diterima,
        brand_name: brand?.nama_perusahaan,
        joined_at: p.joined_at,
        submission_count: stats.count,
        total_views: stats.views,
        total_earning: stats.earning
      };
    });

    // Apply search filter
    if (searchTerm) {
      result = result.filter(r =>
        r.nama_campaign.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.brand_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply platform filter
    if (req.query.platform) {
      result = result.filter(r => r.platform === req.query.platform.toUpperCase());
    }

    // Apply status filter
    if (req.query.status) {
      result = result.filter(r => r.status === req.query.status.toUpperCase());
    }

    // Apply sorting
    const sortField = req.query.sort || '-joined_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];

    result.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Apply pagination
    const paginatedResult = result.slice(offset, offset + limit);

    const response = formatPaginationResponse(paginatedResult, result.length, page, limit);
    res.status(200).json({
      status: 'success',
      data: response.data,
      pagination: response.pagination
    });

  } catch (error) {
    console.error('Get My Campaigns Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil campaign yang diikuti' });
  }
};

module.exports = { 
  createCampaign, 
  updateCampaign,
  topupBudget,
  handleMidtransNotification,
  updateCampaignStatus, 
  updateCampaignLimit, 
  claimRefund, 
  getCampaignAnalytics, 
  exploreCampaigns,
  getBrandCampaigns,
  joinCampaign,
  getCampaignParticipants,
  getMyCampaigns
};
