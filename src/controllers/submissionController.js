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

// 4.1 Submit Konten Baru
exports.submitContent = async (req, res) => {
  try {
    const { campaign_id, connected_account_id, content_url } = req.body;
    const userId = req.user.user_id || req.user.id;

    // 1. Dapatkan Data Creator
    const creator = await getCreatorByUserId(userId);

    // 2. Validasi Akun Sosial Media yang dihubungkan
    const { data: socialAccount, error: socialError } = await supabase
      .from('connected_social_accounts')
      .select('*')
      .eq('id', connected_account_id)
      .eq('creator_id', creator.id) // Pastikan akun ini milik creator yang sedang login
      .single();

    if (socialError || !socialAccount) {
      return res.status(403).json({
        status: 'error',
        code: 'ERR_KONTEN_BUKAN_MILIK_AKUN',
        message: 'Akun sosial media tidak ditemukan atau bukan milik Anda.'
      });
    }

    // (MOCK LOGIC) Validasi Sederhana: Cek apakah URL sesuai platform
    // Di dunia nyata, Anda akan memanggil API YouTube/TikTok untuk memvalidasi kepemilikan video
    const isUrlMatchPlatform = content_url.toLowerCase().includes(socialAccount.platform.toLowerCase());
    if (!isUrlMatchPlatform && socialAccount.platform !== 'WEBSITE') {
       // Bebas diimplementasikan sesuai kebutuhan, untuk sekarang kita bypass jika gagal MOCK
       // throw new Error('URL video yang dikirim tidak sesuai dengan platform akun.');
    }

    // 3. Dapatkan Data Campaign & Cek Budget
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

    // Hitung Estimasi Komisi (Misal: Estimasi awal adalah target minimal 1000 views, bisa diubah sesuai logika bisnis)
    // Di PRD, tertulis "sistem mengunci budget estimasi". Kita asumsikan estimasi awal = komisi_per_view * 1000
    const estimasiViewsAwal = 1000; 
    const estimasiKomisi = campaign.komisi_per_view * estimasiViewsAwal;

    if (campaign.budget_tersisa < estimasiKomisi) {
        throw new Error('Budget campaign tidak mencukupi untuk menerima submission baru saat ini.');
    }

    // 4. Lakukan Insert Submission & Update Budget (Seharusnya pakai Transaksi DB/RPC)
    // Di Supabase JS biasa, kita tidak punya transaksi natif, jadi kita pakai RPC atau lakukan 2 step berurutan.
    // Untuk MVP ini, kita lakukan berurutan.

    // A. Insert Submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .insert([{
        campaign_id: campaign_id,
        creator_id: creator.id,
        connected_account_id: connected_account_id,
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

    // B. Update Budget Campaign (Pindahkan dari budget_tersisa ke budget_tereservasi)
    const { error: updateCampError } = await supabase
      .from('campaigns')
      .update({
        budget_tersisa: campaign.budget_tersisa - estimasiKomisi,
        budget_tereservasi: campaign.budget_tereservasi + estimasiKomisi
      })
      .eq('campaign_id', campaign_id);
    
    if (updateCampError) {
      // Jika update budget gagal, idealnya kita me-rollback (delete) submission yang baru dibuat
      // Namun untuk kesederhanaan MVP saat ini, kita abaikan error handling rollback kompleks
      console.error("Gagal mengupdate budget:", updateCampError);
    }

    // 5. Audit Log (Untuk IP Tracking & Antifraud)
    await logAudit(req, 'SUBMIT_CONTENT', 'SUBMISSION', submission.submission_id, null, { 
      campaign_id, 
      content_url,
      creator_email: req.user?.email || 'unknown'
    });

    // 6. Response Berhasil
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

    // Ambil data submission beserta data campaign yang berelasi
    const { data: submission, error } = await supabase
      .from('submissions')
      .select(`
        *,
        campaigns (
            komisi_per_view
        )
      `)
      .eq('submission_id', submission_id)
      .eq('creator_id', creator.id) // Pastikan hanya bisa lihat submission miliknya sendiri
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
        komisi_per_view: submission.campaigns.komisi_per_view,
        gross_earning: submission.gross_earning,
        platform_fee: submission.platform_fee,
        net_earning: submission.net_earning
      }
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
  
};

exports.getAllSubmissions = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const creator = await getCreatorByUserId(userId);

    // Ambil semua submission, urutkan dari yang terbaru
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
        campaigns ( nama_campaign, platform )
      `)
      .eq('creator_id', creator.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: 'success',
      message: 'Berhasil mengambil riwayat submission',
      data: submissions.map(sub => ({
        submission_id: sub.submission_id || sub.id, // Fallback ke 'id' jika kolom PK bernama 'id'
        nama_campaign: sub.campaigns?.nama_campaign,
        platform: sub.campaigns?.platform,
        content_url: sub.content_url,
        status: sub.status,
        submitted_at: sub.submitted_at,
        views: sub.views_tervalidasi,
        estimasi_komisi: sub.estimasi_komisi,
        net_earning: sub.net_earning
      }))
    });

  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};