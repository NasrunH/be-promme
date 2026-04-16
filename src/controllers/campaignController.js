const supabase = require('../config/supabase');
const { snap } = require('../utils/midtrans');

// 1. CREATE CAMPAIGN
const createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      nama_campaign, budget_total, daily_spend_limit, platform, 
      komisi_per_view, min_watch_duration, max_submission_per_creator,
      tanggal_mulai, tanggal_berakhir 
    } = req.body;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert([{
        brand_id: brand.id,
        nama_campaign,
        budget_total,
        budget_tersisa: 0, // Belum aktif sebelum topup
        daily_spend_limit,
        platform,
        komisi_per_view,
        min_watch_duration,
        max_submission_per_creator,
        tanggal_mulai,
        tanggal_berakhir,
        status: 'DRAFT'
      }])
      .select().single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      data: {
        campaign_id: campaign.campaign_id,
        status: campaign.status
      }
    });

  } catch (error) {
    console.error('Create Campaign Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal membuat campaign' });
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

module.exports = { 
  createCampaign, 
  topupBudget, 
  updateCampaignStatus, 
  updateCampaignLimit, 
  claimRefund, 
  getCampaignAnalytics, 
  exploreCampaigns 
};
