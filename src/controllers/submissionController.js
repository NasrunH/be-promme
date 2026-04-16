const supabase = require('../config/supabase');

// 1. SUBMIT CONTENT
const submitContent = async (req, res) => {
  try {
    const { campaign_id, connected_account_id, content_url } = req.body;
    const userId = req.user.id;

    // Get Creator ID
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();

    // 1. Validasi Campaign
    const { data: campaign } = await supabase.from('campaigns').select('*').eq('campaign_id', campaign_id).single();
    if (!campaign || campaign.status !== 'AKTIF') {
       return res.status(400).json({ status: 'error', message: 'Campaign tidak aktif atau tidak ditemukan' });
    }

    // 2. Budget Reservation Logic (Simplified)
    // Check if remaining budget > commission per view
    if (campaign.budget_tersisa < campaign.komisi_per_view) {
        return res.status(400).json({ status: 'error', message: 'Budget campaign sudah habis' });
    }

    // 3. Insert Submission
    const { data: submission, error } = await supabase
      .from('submissions')
      .insert([{
        campaign_id,
        creator_id: creator.id,
        connected_account_id,
        content_url,
        status: 'PENDING',
        estimasi_komisi: campaign.komisi_per_view * 1000 // Mocking 1000 views estimation
      }])
      .select().single();

    if (error) {
        if (error.code === '23505') return res.status(400).json({ status: 'error', message: 'Konten ini sudah pernah di-submit' });
        throw error;
    }

    // Lock Budget (Reservation)
    await supabase.rpc('reserve_budget', { 
        camp_id: campaign_id, 
        amount: campaign.komisi_per_view * 1000 
    });

    res.status(201).json({
      status: 'success',
      message: 'Submission diterima, sistem mengunci budget estimasi',
      data: {
        submission_id: submission.submission_id,
        status: 'PENDING',
        estimasi_komisi: submission.estimasi_komisi
      }
    });

  } catch (error) {
    console.error('Submission Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal melakukan submission' });
  }
};

// 2. CHECK STATUS
const checkStatus = async (req, res) => {
  try {
    const { submission_id } = req.params;
    const { data: sub, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('submission_id', submission_id)
      .single();

    if (!sub) return res.status(404).json({ message: 'Submission tidak ditemukan' });

    res.status(200).json({
      status: 'success',
      data: {
        submission_id: sub.submission_id,
        status: sub.status,
        views_tervalidasi: sub.views_tervalidasi,
        komisi_per_view: sub.estimasi_komisi / 1000,
        gross_earning: sub.gross_earning,
        platform_fee: sub.platform_fee,
        net_earning: sub.net_earning
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// 3. GET MY SUBMISSIONS (Creator tracking)
const getMySubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();

    const { data: subs, error } = await supabase
      .from('submissions')
      .select('*, campaigns(nama_campaign)')
      .eq('creator_id', creator.id);

    if(error) throw error;
    
    res.status(200).json({ status: 'success', data: subs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat submission' });
  }
};


module.exports = { submitContent, checkStatus, getMySubmissions };
