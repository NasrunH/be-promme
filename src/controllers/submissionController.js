const supabase = require('../config/supabase');
const { logAudit } = require('../utils/auditLogger');
const { scrapeViews } = require('../services/scraperService');
const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');

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

// 4.1 Submit Konten Baru (WAJIB JOIN DULU)
exports.submitContent = async (req, res) => {
  try {
    const { campaign_id, connected_account_id, content_url } = req.body;
    const userId = req.user.user_id || req.user.id;

    // 1. Dapatkan Data Creator
    const creator = await getCreatorByUserId(userId);

    // 2. === GUARD: WAJIB JOIN CAMPAIGN DULU ===
    const { data: participant } = await supabase
      .from('campaign_participants')
      .select('id')
      .eq('campaign_id', campaign_id)
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json({
        status: 'error',
        code: 'ERR_NOT_JOINED',
        message: 'Anda belum bergabung dengan campaign ini. Silakan join terlebih dahulu sebelum submit konten.'
      });
    }

    // 3. Validasi Akun Sosial Media (jika connected_account_id disertakan)
    if (connected_account_id) {
      const { data: socialAccount, error: socialError } = await supabase
        .from('connected_social_accounts')
        .select('*')
        .eq('id', connected_account_id)
        .eq('creator_id', creator.id)
        .single();

      if (socialError || !socialAccount) {
        return res.status(403).json({
          status: 'error',
          code: 'ERR_KONTEN_BUKAN_MILIK_AKUN',
          message: 'Akun sosial media tidak ditemukan atau bukan milik Anda.'
        });
      }
    }

    // 4. Dapatkan Data Campaign & Cek Status
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaign_id)
      .single();

    if (campError || !campaign) {
      throw new Error('Campaign tidak ditemukan.');
    }

    if (campaign.status !== 'AKTIF') {
       throw new Error(`Campaign saat ini berstatus ${campaign.status}. Anda tidak dapat melakukan submission.`);
    }

    // 4.5 Validasi Platform URL
    const p = campaign.platform?.toUpperCase();
    const url = content_url?.toLowerCase();
    let isMatch = false;
    if (p === 'YOUTUBE' && (url.includes('youtube.com') || url.includes('youtu.be'))) isMatch = true;
    else if (p === 'TIKTOK' && url.includes('tiktok.com')) isMatch = true;
    else if (p === 'INSTAGRAM' && url.includes('instagram.com')) isMatch = true;

    if (!isMatch) {
      return res.status(400).json({ 
        status: 'error', 
        message: `URL tidak valid. Campaign ini hanya menerima konten dari ${campaign.platform}.` 
      });
    }

    // 5. Cek batas max submission per creator
    const { count: existingSubmissions } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)
      .eq('creator_id', creator.id);

    if (existingSubmissions >= campaign.max_submission_per_creator) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_MAX_SUBMISSION',
        message: `Anda sudah mencapai batas maksimum ${campaign.max_submission_per_creator} submission untuk campaign ini.`
      });
    }

    // 6. Hitung Estimasi Komisi Awal (asumsi 1000 views pertama)
    const estimasiViewsAwal = 1000; 
    const estimasiKomisi = campaign.komisi_per_view; // Karena per 1000 views

    if (campaign.budget_tersisa < estimasiKomisi) {
        throw new Error('Budget campaign tidak mencukupi untuk menerima submission baru saat ini.');
    }

    // 7. Penarikan Views Pertama Kali (Instant Tracking)
    let initialViews = 0;
    try {
      initialViews = await scrapeViews(content_url, campaign.platform) || 0;
    } catch (err) {
      console.error("[SUBMIT] Initial scraping failed:", err.message);
    }

    // 8. Hitung Komisi Berdasarkan Views Awal
    // Komisi dihitung per kelipatan 1000 views
    const grossEarning = Math.floor(initialViews / 1000) * campaign.komisi_per_view;
    
    // 9. Insert Submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .insert([{
        campaign_id: campaign_id,
        creator_id: creator.id,
        connected_account_id: connected_account_id || null,
        content_url: content_url,
        status: 'PENDING',
        views_tervalidasi: initialViews,
        estimasi_komisi: estimasiKomisi,
        gross_earning: grossEarning,
        net_earning: grossEarning // Sementara asumsi fee 0 atau sudah dipotong
      }])
      .select()
      .single();

    if (subError) {
      if (subError.code === '23505') throw new Error('Anda sudah pernah mensubmit URL konten ini untuk campaign ini.');
      throw subError;
    }

    // 8. Update Budget Campaign (estimasi)
    const { error: updateCampError } = await supabase
      .from('campaigns')
      .update({
        budget_tersisa: campaign.budget_tersisa - estimasiKomisi,
        budget_tereservasi: (campaign.budget_tereservasi || 0) + estimasiKomisi
      })
      .eq('campaign_id', campaign_id);
    
    if (updateCampError) {
      console.error("Gagal mengupdate budget:", updateCampError);
    }

    // 9. Audit Log (Untuk IP Tracking & Antifraud)
    try {
      await logAudit(req, 'SUBMIT_CONTENT', 'SUBMISSION', submission.submission_id, null, { 
        campaign_id, 
        content_url,
        creator_email: req.user?.email || 'unknown'
      });
    } catch (logErr) {
      console.error('Audit log error:', logErr);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Submission diterima, sistem mengunci budget estimasi',
      data: {
        submission_id: submission.submission_id,
        status: submission.status,
        estimasi_komisi: submission.estimasi_komisi
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// 4.2 Cek Status Submission
exports.getSubmissionStatus = async (req, res) => {
  try {
    const { submission_id } = req.params;
    const userId = req.user.user_id || req.user.id;

    const creator = await getCreatorByUserId(userId);

    const { data: submission, error } = await supabase
      .from('submissions')
      .select(`
        *,
        campaigns (
            komisi_per_view, nama_campaign, platform
        )
      `)
      .eq('submission_id', submission_id)
      .eq('creator_id', creator.id)
      .single();

    if (error || !submission) {
      return res.status(404).json({
        status: 'error',
        message: 'Submission tidak ditemukan atau bukan milik Anda.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        submission_id: submission.submission_id,
        status: submission.status,
        views_tervalidasi: submission.views_tervalidasi,
        content_url: submission.content_url,
        nama_campaign: submission.campaigns?.nama_campaign,
        platform: submission.campaigns?.platform,
        komisi_per_view: submission.campaigns?.komisi_per_view,
        gross_earning: submission.gross_earning,
        platform_fee: submission.platform_fee,
        net_earning: submission.net_earning,
        submitted_at: submission.submitted_at
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// 4.3 Semua Submission Creator (All Campaigns)
/**
 * Get all creator submissions dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: nama_campaign, content_url
 * @query {string} status - Filter: PENDING, APPROVED, REJECTED
 * @query {string} platform - Filter: INSTAGRAM, TIKTOK, YOUTUBE
 * @query {number} earning_min - Filter minimum earning
 * @query {number} earning_max - Filter maximum earning
 * @query {string} sort - Sort: submitted_at, -submitted_at, net_earning, -net_earning, views_tervalidasi, -views_tervalidasi
 */
exports.getAllSubmissions = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const creator = await getCreatorByUserId(userId);
    const { page, limit, offset } = parsePagination(req.query);
    const searchTerm = req.query.search ? req.query.search.trim() : '';

    let query = supabase
      .from('submissions')
      .select(`
        submission_id,
        status,
        content_url,
        submitted_at,
        views_tervalidasi,
        net_earning,
        estimasi_komisi,
        alasan_penolakan,
        campaigns ( campaign_id, nama_campaign, platform, komisi_per_view )
      `, { count: 'exact' })
      .eq('creator_id', creator.id);

    // Apply filters
    if (req.query.status) {
      query = query.eq('status', req.query.status.toUpperCase());
    }

    if (req.query.platform) {
      query = query.eq('campaigns.platform', req.query.platform.toUpperCase());
    }

    // Apply earning range filters
    if (req.query.earning_min) {
      query = query.gte('net_earning', parseFloat(req.query.earning_min));
    }
    if (req.query.earning_max) {
      query = query.lte('net_earning', parseFloat(req.query.earning_max));
    }

    // Apply sorting
    const sortField = req.query.sort || '-submitted_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];
    query = query.order(field, { ascending: direction === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: submissions, error, count } = await query;

    if (error) throw error;

    const data = (submissions || []).map(sub => ({
      submission_id: sub.submission_id,
      campaign_id: sub.campaigns?.campaign_id,
      nama_campaign: sub.campaigns?.nama_campaign,
      platform: sub.campaigns?.platform,
      komisi_per_view: sub.campaigns?.komisi_per_view,
      content_url: sub.content_url,
      status: sub.status,
      submitted_at: sub.submitted_at,
      views: sub.views_tervalidasi || 0,
      estimasi_komisi: sub.estimasi_komisi || 0,
      net_earning: sub.net_earning || 0,
      alasan_penolakan: sub.alasan_penolakan || null
    }));

    // Apply search filter on mapped data
    if (searchTerm) {
      data = data.filter(d => 
        d.nama_campaign.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.content_url.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const response = formatPaginationResponse(data, count || 0, page, limit);
    return res.status(200).json({
      status: 'success',
      message: 'Berhasil mengambil riwayat submission',
      ...response
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// 4.4 Submission per Campaign (untuk tracking di My Campaigns)
/**
 * Get creator's submissions for specific campaign dengan pagination dan filter
 * @param {string} campaign_id - Campaign ID
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} status - Filter: PENDING, APPROVED, REJECTED
 * @query {number} views_min - Filter minimum views
 * @query {number} views_max - Filter maximum views
 * @query {string} sort - Sort: submitted_at, -submitted_at, views_tervalidasi, -views_tervalidasi, net_earning, -net_earning
 */
exports.getSubmissionsByCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.user_id || req.user.id;
    const { page, limit, offset } = parsePagination(req.query);

    const creator = await getCreatorByUserId(userId);

    // Pastikan creator sudah join campaign ini
    const { data: participant } = await supabase
      .from('campaign_participants')
      .select('id')
      .eq('campaign_id', campaign_id)
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak terdaftar dalam campaign ini.'
      });
    }

    // Ambil data campaign untuk header & aset
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('campaign_id, nama_campaign, platform, komisi_per_view, status, tanggal_berakhir, min_konten_diterima, asset_urls, min_watch_duration, max_submission_per_creator, budget_tersisa')
      .eq('campaign_id', campaign_id)
      .single();

    let query = supabase
      .from('submissions')
      .select(`
        submission_id,
        content_url,
        status,
        submitted_at,
        views_tervalidasi,
        estimasi_komisi,
        gross_earning,
        net_earning,
        alasan_penolakan
      `, { count: 'exact' })
      .eq('campaign_id', campaign_id)
      .eq('creator_id', creator.id);

    // Apply filters
    if (req.query.status) {
      query = query.eq('status', req.query.status.toUpperCase());
    }

    // Apply views range filters
    if (req.query.views_min) {
      query = query.gte('views_tervalidasi', parseInt(req.query.views_min));
    }
    if (req.query.views_max) {
      query = query.lte('views_tervalidasi', parseInt(req.query.views_max));
    }

    // Apply sorting
    const sortField = req.query.sort || '-submitted_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];
    query = query.order(field, { ascending: direction === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: submissions, error, count } = await query;

    if (error) throw error;

    const submissionData = (submissions || []).map(s => ({
      submission_id: s.submission_id,
      content_url: s.content_url,
      status: s.status,
      submitted_at: s.submitted_at,
      views: s.views_tervalidasi || 0,
      estimasi_komisi: s.estimasi_komisi || 0,
      gross_earning: s.gross_earning || 0,
      net_earning: s.net_earning || 0,
      alasan_penolakan: s.alasan_penolakan || null
    }));

    const response = formatPaginationResponse(submissionData, count || 0, page, limit);

    return res.status(200).json({
      status: 'success',
      data: {
        campaign_info: campaign,
        submissions: response.data
      },
      pagination: response.pagination
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};
