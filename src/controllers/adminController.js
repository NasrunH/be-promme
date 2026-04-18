const supabase = require('../config/supabase');

const listUsers = async (req, res) => {
    try {
        // Melakukan JOIN dengan tabel creators untuk mendapatkan id (creator_id) dan kyc_status
        const { data: users, error } = await supabase.from('users').select(`
            id, email, role, status, created_at,
            creators ( id, kyc_status )
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
    res.json({ status: 'success', data: [] });
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
