const supabase = require('../config/supabase');
const { logAudit } = require('../utils/auditLogger');

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

    // 7. Insert Submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .insert([{
        campaign_id: campaign_id,
        creator_id: creator.id,
        connected_account_id: connected_account_id || null,
        content_url: content_url,
        status: 'PENDING',
        estimasi_komisi: estimasiKomisi
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
exports.getAllSubmissions = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const creator = await getCreatorByUserId(userId);

    const { data: submissions, error } = await supabase
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
      `)
      .eq('creator_id', creator.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: 'success',
      message: 'Berhasil mengambil riwayat submission',
      data: (submissions || []).map(sub => ({
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
      }))
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// 4.4 Submission per Campaign (untuk tracking di My Campaigns)
exports.getSubmissionsByCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const userId = req.user.user_id || req.user.id;

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

    const { data: submissions, error } = await supabase
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
      `)
      .eq('campaign_id', campaign_id)
      .eq('creator_id', creator.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: 'success',
      data: {
        campaign_info: campaign,
        submissions: (submissions || []).map(s => ({
          submission_id: s.submission_id,
          content_url: s.content_url,
          status: s.status,
          submitted_at: s.submitted_at,
          views: s.views_tervalidasi || 0,
          estimasi_komisi: s.estimasi_komisi || 0,
          gross_earning: s.gross_earning || 0,
          net_earning: s.net_earning || 0,
          alasan_penolakan: s.alasan_penolakan || null
        }))
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};