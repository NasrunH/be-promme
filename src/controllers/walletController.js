const supabase = require('../config/supabase');
const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');

// 1. GET WALLET BALANCE (Enriched with summary)
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    if (!creator) return res.status(404).json({ status: 'error', message: 'Creator tidak ditemukan' });
    
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('creator_id', creator.id)
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: {
        wallet_id: wallet.wallet_id,
        balance: wallet.balance || 0,
        hold_balance: wallet.hold_balance || 0,
        pending_balance: wallet.pending_balance || 0,
        total_earned: wallet.total_earned || 0,
        total_withdrawn: wallet.total_withdrawn || 0
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data dompet' });
  }
};

// 2. REQUEST WITHDRAWAL
const requestWithdrawal = async (req, res) => {
  try {
    const { amount, bank_account_id, idempotency_key } = req.body;
    const userId = req.user.id;

    const { data: creator } = await supabase.from('creators').select('id, kyc_status').eq('user_id', userId).single();
    
    if (creator.kyc_status !== 'VERIFIED') {
        return res.status(403).json({ status: 'error', message: 'Akun harus terverifikasi KYC sebelum menarik dana' });
    }

    if (amount < 50000) {
        return res.status(400).json({ status: 'error', message: 'Minimal penarikan adalah Rp 50.000' });
    }

    const { data: wallet } = await supabase.from('wallets').select('balance, pending_balance, version').eq('creator_id', creator.id).single();
    if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ status: 'error', message: 'Saldo tidak mencukupi' });
    }

    // 4. Update Wallet (Deduct Balance and move to Pending)
    const { error: walletError } = await supabase
      .from('wallets')
      .update({
        balance: wallet.balance - amount,
        pending_balance: (wallet.pending_balance || 0) + amount,
        version: (wallet.version || 0) + 1
      })
      .eq('creator_id', creator.id);

    if (walletError) throw walletError;

    const { data: wd, error } = await supabase
      .from('withdrawals')
      .insert([{
        creator_id: creator.id,
        amount,
        bank_account_id,
        idempotency_key,
        status: 'QUEUED'
      }])
      .select().single();

    if (error) {
        // Rollback balance if withdrawal insert fails
        await supabase.from('wallets').update({
            balance: wallet.balance,
            pending_balance: wallet.pending_balance
        }).eq('creator_id', creator.id);

        if (error.code === '23505') return res.status(400).json({ status: 'error', message: 'Request penarikan sudah ada (Idempotent)' });
        throw error;
    }

    // 5. Create Transaction Record
    await supabase.from('wallet_transactions').insert([{
        wallet_id: (await supabase.from('wallets').select('wallet_id').eq('creator_id', creator.id).single()).data.wallet_id,
        type: 'WITHDRAWAL',
        amount: amount,
        idempotency_key: `WD-TX-${idempotency_key}`
    }]);

    res.status(202).json({
      status: 'success',
      message: 'Penarikan diajukan dan masuk antrian diproses',
      data: {
        withdrawal_id: wd.withdrawal_id,
        amount: wd.amount,
        status: 'QUEUED'
      }
    });

  } catch (error) {
    console.error('Withdrawal Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengajukan penarikan' });
  }
};

/**
 * Get wallet transactions dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} type - Filter: CREDIT, DEBIT
 * @query {number} amount_min - Filter minimum amount
 * @query {number} amount_max - Filter maximum amount
 * @query {string} sort - Sort: created_at, -created_at, amount, -amount
 */
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = parsePagination(req.query);
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    
    const { data: wallet } = await supabase.from('wallets').select('wallet_id').eq('creator_id', creator.id).single();
    if (!wallet) return res.status(404).json({ message: 'Dompet tidak ditemukan' });

    let query = supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('wallet_id', wallet.wallet_id);

    // Apply type filter
    if (req.query.type) {
      query = query.eq('type', req.query.type.toUpperCase());
    }

    // Apply amount range filters
    if (req.query.amount_min) {
      query = query.gte('amount', parseFloat(req.query.amount_min));
    }
    if (req.query.amount_max) {
      query = query.lte('amount', parseFloat(req.query.amount_max));
    }

    // Apply sorting
    const sortField = req.query.sort || '-created_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];
    query = query.order(field, { ascending: direction === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: txs, error, count } = await query;

    if(error) throw error;
    
    const response = formatPaginationResponse(txs || [], count || 0, page, limit);
    res.status(200).json({ status: 'success', ...response });
  } catch(error) {
    console.error('Get Wallet Transactions Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat transaksi' });
  }
};

/**
 * Get earning details dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} platform - Filter: INSTAGRAM, TIKTOK, YOUTUBE
 * @query {string} payment_status - Filter: DIBAYAR, MENUNGGU_PEMBAYARAN, DITOLAK, BELUM_SELESAI
 * @query {number} earning_min - Filter minimum earning
 * @query {number} earning_max - Filter maximum earning
 * @query {string} sort - Sort: submitted_at, -submitted_at, net_earning, -net_earning, views, -views
 */
const getEarningDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = parsePagination(req.query);
    const { data: creator, error: creatorErr } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (creatorErr || !creator) {
      return res.status(404).json({ status: 'error', message: 'Creator tidak ditemukan' });
    }

    // Ambil semua submission yang sudah ada earning (tidak hanya pending)
    const { data: submissions, error: subErr } = await supabase
      .from('submissions')
      .select(`
        submission_id,
        content_url,
        status,
        submitted_at,
        views_tervalidasi,
        estimasi_komisi,
        gross_earning,
        platform_fee,
        net_earning,
        campaigns (
          campaign_id,
          nama_campaign,
          platform,
          komisi_per_view
        )
      `)
      .eq('creator_id', creator.id)
      .order('submitted_at', { ascending: false });

    if (subErr) throw subErr;

    // Hitung summary totals dari submissions
    let totalEarned = 0;
    let totalPending = 0;

    let earningRows = (submissions || []).map(s => {
      const campData = Array.isArray(s.campaigns) ? s.campaigns[0] : s.campaigns;
      const netEarning = s.net_earning || 0;
      const isPaid = s.status === 'SELESAI';
      const isPending = s.status === 'SIAP_BAYAR' || s.status === 'DIPROSES';

      if (isPaid) totalEarned += netEarning;
      if (isPending) totalPending += (s.estimasi_komisi || 0);

      return {
        submission_id: s.submission_id,
        campaign_id: campData?.campaign_id,
        nama_campaign: campData?.nama_campaign || '-',
        platform: campData?.platform || '-',
        content_url: s.content_url,
        status: s.status,
        submitted_at: s.submitted_at,
        views: s.views_tervalidasi || 0,
        estimasi_komisi: s.estimasi_komisi || 0,
        gross_earning: s.gross_earning || 0,
        platform_fee: s.platform_fee || 0,
        net_earning: netEarning,
        payment_status: isPaid ? 'DIBAYAR' : isPending ? 'MENUNGGU_PEMBAYARAN' : s.status === 'DITOLAK' ? 'DITOLAK' : 'BELUM_SELESAI'
      };
    });

    // Apply platform filter
    if (req.query.platform) {
      earningRows = earningRows.filter(r => r.platform === req.query.platform.toUpperCase());
    }

    // Apply payment_status filter
    if (req.query.payment_status) {
      earningRows = earningRows.filter(r => r.payment_status === req.query.payment_status.toUpperCase());
    }

    // Apply earning range filters
    if (req.query.earning_min) {
      earningRows = earningRows.filter(r => r.net_earning >= parseFloat(req.query.earning_min));
    }
    if (req.query.earning_max) {
      earningRows = earningRows.filter(r => r.net_earning <= parseFloat(req.query.earning_max));
    }

    // Apply sorting
    const sortField = req.query.sort || '-submitted_at';
    const [field, direction] = sortField.startsWith('-') 
      ? [sortField.substring(1), 'desc'] 
      : [sortField, 'asc'];

    earningRows.sort((a, b) => {
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
    const paginatedRows = earningRows.slice(offset, offset + limit);

    // Hitung per-campaign summary from all rows (not paginated)
    const campaignSummary = {};
    earningRows.forEach(row => {
      if (!row.campaign_id) return;
      if (!campaignSummary[row.campaign_id]) {
        campaignSummary[row.campaign_id] = {
          campaign_id: row.campaign_id,
          nama_campaign: row.nama_campaign,
          platform: row.platform,
          submission_count: 0,
          total_views: 0,
          total_earning: 0
        };
      }
      campaignSummary[row.campaign_id].submission_count++;
      campaignSummary[row.campaign_id].total_views += row.views;
      campaignSummary[row.campaign_id].total_earning += row.net_earning;
    });

    const response = formatPaginationResponse(paginatedRows, earningRows.length, page, limit);

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          total_earned: totalEarned,
          total_pending: totalPending
        },
        per_campaign: Object.values(campaignSummary),
        earnings: response.data
      },
      pagination: response.pagination
    });

  } catch (error) {
    console.error('Get Earning Details Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil detail pendapatan' });
  }
};

module.exports = { getWalletBalance, requestWithdrawal, getWalletTransactions, getEarningDetails };
