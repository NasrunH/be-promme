const supabase = require('../config/supabase');

const listUsers = async (req, res) => {
    try {
        // [REVISI]: Mengambil semua data (*) dari tabel creators dan brands
        const { data: users, error } = await supabase.from('users').select(`
            id, email, role, status, created_at,
            creators ( * ),
            brands ( * )
        `);
        
        if (error) throw error;
        
        res.json({ status: 'success', data: users });
    } catch (e) { 
        console.error("List Users Error:", e);
        res.status(500).json({ status: 'error', message: 'Gagal menarik data pengguna' }); 
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await supabase.from('users').update({ status }).eq('id', req.params.id);
        res.json({ status: 'success', message: 'Status diupdate' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const reviewKyc = async (req, res) => {
    try {
        const { status } = req.body; // VERIFIED or REJECTED
        await supabase.from('creators').update({ kyc_status: status }).eq('id', req.params.creator_id);
        res.json({ status: 'success', message: `KYC ${status}` });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const updatePlatformFee = async (req, res) => {
    res.json({ status: 'success', message: 'Platform fee updated' });
};

const forceCancelCampaign = async (req, res) => {
    try {
        await supabase.from('campaigns').update({ status: 'DIBATALKAN' }).eq('campaign_id', req.params.campaign_id);
        res.json({ status: 'success', message: 'Campaign dibatalkan paksa' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

// Fraud Ops
const getAnomalies = async (req, res) => {
    try {
        // 1. Ambil data Wallet beserta email pemiliknya
        const { data: wallets } = await supabase.from('wallets').select(`
            wallet_id, balance, held_balance,
            users ( email, role )
        `);

        // 2. Ambil data Submission (kecuali yang sudah DITOLAK) beserta nama campaign & creator
        const { data: submissions } = await supabase.from('submissions').select(`
            submission_id, views_tervalidasi, status, created_at,
            campaigns ( nama_campaign ),
            creators ( nama_lengkap )
        `).neq('status', 'DITOLAK').order('created_at', { ascending: false }).limit(50);

        // 3. Ambil data Campaign yang masih berjalan/dijeda beserta nama Brand
        const { data: campaigns } = await supabase.from('campaigns').select(`
            campaign_id, nama_campaign, status, budget_total, budget_tersisa,
            brands ( nama_perusahaan )
        `).in('status', ['AKTIF', 'DIJEDA']).order('created_at', { ascending: false });

        res.json({
            status: 'success',
            data: {
                wallets: wallets || [],
                submissions: submissions || [],
                campaigns: campaigns || []
            }
        });
    } catch (e) {
        console.error("Get Anomalies Error:", e);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data list fraud ops' });
    }
};

const holdWalletBalance = async (req, res) => {
    try {
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('wallet_id', req.params.wallet_id).single();
        await supabase.from('wallets').update({ 
            balance: 0, 
            held_balance: wallet.balance || 0 
        }).eq('wallet_id', req.params.wallet_id);
        res.json({ status: 'success', message: 'Saldo dibekukan untuk investigasi' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const releaseWalletBalance = async (req, res) => {
    try {
        const { data: wallet } = await supabase.from('wallets').select('held_balance').eq('wallet_id', req.params.wallet_id).single();
        await supabase.from('wallets').update({ 
            balance: wallet.held_balance || 0, 
            held_balance: 0 
        }).eq('wallet_id', req.params.wallet_id);
        res.json({ status: 'success', message: 'Saldo dibebaskan' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const invalidateSubmission = async (req, res) => {
    try {
        await supabase.from('submissions').update({ status: 'DITOLAK' }).eq('submission_id', req.params.submission_id);
        res.json({ status: 'success', message: 'Submission ditolak paksa' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const getAuditLogs = async (req, res) => {
    res.json({ status: 'success', data: [] });
};

module.exports = {
   listUsers, updateUserStatus, reviewKyc, updatePlatformFee, forceCancelCampaign,
   getAnomalies, holdWalletBalance, releaseWalletBalance, invalidateSubmission, getAuditLogs
};