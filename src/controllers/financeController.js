const supabase = require('../config/supabase');

const getLargePendingWithdrawals = async (req, res) => {
    try {
        // Mock large > 10 million
        const { data: wds } = await supabase.from('withdrawals').select('*').eq('status', 'QUEUED').gte('amount', 10000000);
        res.json({ status: 'success', data: wds });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const approveWithdrawal = async (req, res) => {
    try {
        await supabase.from('withdrawals').update({ status: 'APPROVED' }).eq('withdrawal_id', req.params.id);
        res.json({ status: 'success', message: 'Withdrawal approved. Triggering Iris payout...' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const getFailedWithdrawals = async (req, res) => {
    try {
        const { data: wds } = await supabase.from('withdrawals').select('*').eq('status', 'FAILED');
        res.json({ status: 'success', data: wds });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const calculateTax = async (req, res) => {
    try {
        const { data: creators } = await supabase.from('creators').select('id, user_id, npwp');
        // Return dummy mock for tax calculation logic
        res.json({ status: 'success', data: creators.map(c => ({ creator_id: c.id, has_npwp: !!c.npwp, estimated_tax_rate: c.npwp ? 0.02 : 0.04 })) });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const getGmvReport = async (req, res) => {
    try {
        const { data: topups } = await supabase.from('topup_transactions').select('gross_amount').eq('status', 'SETTLEMENT');
        const gmv = topups ? topups.reduce((a, b) => a + Number(b.gross_amount), 0) : 0;
        res.json({ status: 'success', data: { total_gmv: gmv } });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const getRevenueReport = async (req, res) => {
   res.json({ status: 'success', data: { total_revenue: 0 } });
};

module.exports = {
   getLargePendingWithdrawals, approveWithdrawal, getFailedWithdrawals,
   calculateTax, getGmvReport, getRevenueReport
};
