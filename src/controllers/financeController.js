const supabase = require('../config/supabase');
const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');

/**
 * Get large pending withdrawals dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: creator name, bank account
 * @query {number} amount_min - Filter minimum amount
 * @query {number} amount_max - Filter maximum amount
 * @query {string} sort - Sort: created_at, -created_at, amount, -amount
 */
/**
 * Get all pending withdrawals for review
 */
const getPendingWithdrawals = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const searchTerm = req.query.search ? req.query.search.trim() : '';

        let query = supabase
            .from('withdrawals')
            .select('*, creators(id, nama_lengkap), creator_bank_accounts(*)', { count: 'exact' })
            .eq('status', 'QUEUED'); // QUEUED means awaiting review

        // Apply filters
        if (req.query.amount_min) query = query.gte('amount', parseFloat(req.query.amount_min));
        if (req.query.amount_max) query = query.lte('amount', parseFloat(req.query.amount_max));

        const sortField = req.query.sort || '-created_at';
        const [field, direction] = sortField.startsWith('-') ? [sortField.substring(1), 'desc'] : [sortField, 'asc'];
        query = query.order(field, { ascending: direction === 'asc' }).range(offset, offset + limit - 1);

        const { data: wds, error, count } = await query;
        if (error) throw error;

        let result = wds || [];
        if (searchTerm) {
            result = result.filter(w => {
                const creatorName = Array.isArray(w.creators) ? w.creators[0]?.nama_lengkap : w.creators?.nama_lengkap;
                return creatorName?.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }

        const response = formatPaginationResponse(result, count || 0, page, limit);
        res.json({ status: 'success', ...response });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

const approveWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const supabaseAdmin = require('../config/supabaseAdmin');

        // 1. Get withdrawal info
        const { data: wd, error: wdError } = await supabaseAdmin
            .from('withdrawals')
            .select('*')
            .eq('withdrawal_id', id)
            .single();

        if (wdError || !wd) return res.status(404).json({ status: 'error', message: 'Withdrawal not found' });
        if (wd.status !== 'QUEUED') return res.status(400).json({ status: 'error', message: 'Only QUEUED withdrawals can be approved' });

        const amount = Number(wd.amount);

        // 2. Start Approval Process
        const { error: updateWdError } = await supabaseAdmin
            .from('withdrawals')
            .update({ status: 'APPROVED' })
            .eq('withdrawal_id', id);
        
        if (updateWdError) throw updateWdError;

        // Deduct from pending_balance and add to total_withdrawn
        const { data: wallet, error: walletFetchError } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('creator_id', wd.creator_id)
            .single();

        if (walletFetchError) throw walletFetchError;

        if (wallet) {
            const { error: walletUpdateError } = await supabaseAdmin
                .from('wallets')
                .update({ 
                    pending_balance: Math.max(0, (Number(wallet.pending_balance) || 0) - amount),
                    total_withdrawn: (Number(wallet.total_withdrawn) || 0) + amount
                })
                .eq('wallet_id', wallet.wallet_id);

            if (walletUpdateError) throw walletUpdateError;

            // Add success transaction record
            await supabaseAdmin.from('wallet_transactions').insert([{
                wallet_id: wallet.wallet_id,
                type: 'WITHDRAWAL_SUCCESS',
                amount: amount,
                reference_id: id,
                idempotency_key: `WD-SUCCESS-${id}`
            }]);
        }

        res.json({ status: 'success', message: 'Withdrawal approved successfully' });
    } catch (e) {
        console.error('Approve Withdrawal Error:', e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal menyetujui pencairan' });
    }
};

const rejectWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const supabaseAdmin = require('../config/supabaseAdmin');

        // 1. Get withdrawal info
        const { data: wd, error: wdError } = await supabaseAdmin
            .from('withdrawals')
            .select('*')
            .eq('withdrawal_id', id)
            .single();

        if (wdError || !wd) return res.status(404).json({ status: 'error', message: 'Withdrawal not found' });
        if (wd.status !== 'QUEUED') return res.status(400).json({ status: 'error', message: 'Only QUEUED withdrawals can be rejected' });

        const amount = Number(wd.amount);

        // 2. Refund to balance and deduct from pending_balance
        const { data: wallet, error: walletFetchError } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('creator_id', wd.creator_id)
            .single();

        if (walletFetchError) throw walletFetchError;

        if (wallet) {
            const { error: walletUpdateError } = await supabaseAdmin
                .from('wallets')
                .update({ 
                    balance: (Number(wallet.balance) || 0) + amount,
                    pending_balance: Math.max(0, (Number(wallet.pending_balance) || 0) - amount)
                })
                .eq('wallet_id', wallet.wallet_id);
            
            if (walletUpdateError) throw walletUpdateError;

            // Add refund transaction record
            await supabaseAdmin.from('wallet_transactions').insert([{
                wallet_id: wallet.wallet_id,
                type: 'WITHDRAWAL_FAILED',
                amount: amount,
                reference_id: id,
                idempotency_key: `WD-REFUND-${id}`
            }]);
        }

        // 3. Update withdrawal status
        const { error: updateWdError } = await supabaseAdmin
            .from('withdrawals')
            .update({ 
                status: 'REJECTED'
            })
            .eq('withdrawal_id', id);

        if (updateWdError) throw updateWdError;

        res.json({ status: 'success', message: 'Withdrawal rejected and funds returned to creator balance' });
    } catch (e) {
        console.error('Reject Withdrawal Error:', e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal menolak pencairan' });
    }
};

/**
 * Get failed withdrawals dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: creator name, failure_reason
 * @query {number} amount_min - Filter minimum amount
 * @query {number} amount_max - Filter maximum amount
 * @query {string} sort - Sort: created_at, -created_at, amount, -amount
 */
const getFailedWithdrawals = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const searchTerm = req.query.search ? req.query.search.trim() : '';

        let query = supabase
            .from('withdrawals')
            .select('*, creators(id, nama_lengkap), creator_bank_accounts(*)', { count: 'exact' })
            .in('status', ['FAILED', 'REJECTED']);

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

        const { data: wds, error, count } = await query;

        if (error) throw error;

        // Apply search on mapped data
        let result = wds || [];
        if (searchTerm) {
            result = result.filter(w => {
                const creatorName = Array.isArray(w.creators) ? w.creators[0]?.nama_lengkap : w.creators?.nama_lengkap;
                return creatorName?.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }

        const response = formatPaginationResponse(result, count || 0, page, limit);
        res.json({ status: 'success', ...response });
    } catch (e) { 
        console.error('Get Failed Withdrawals Error:', e);
        res.status(500).json({ status: 'error', message: e.message }); 
    }
};

const calculateTax = async (req, res) => {
    try {
        // Tambahkan 'nama_lengkap' dalam select
        const { data: creators } = await supabase
            .from('creators')
            .select('id, user_id, npwp, nama_lengkap');

        if (!creators) throw new Error('Data creator tidak ditemukan');

        res.json({ 
            status: 'success', 
            data: creators.map(c => ({ 
                creator_id: c.id, 
                nama_creator: c.nama_lengkap, // Data baru yang dikirim ke frontend
                has_npwp: !!c.npwp, 
                estimated_tax_rate: c.npwp ? 0.02 : 0.04 
            })) 
        });
    } catch (e) { 
        res.status(500).json({ status: 'error', message: e.message }); 
    }
};

const getGmvReport = async (req, res) => {
    try {
        const { data: topups } = await supabase.from('topup_transactions').select('gross_amount').eq('status', 'SETTLEMENT');
        const gmv = topups ? topups.reduce((a, b) => a + Number(b.gross_amount), 0) : 0;
        res.json({ status: 'success', data: { total_gmv: gmv } });
    } catch (e) { res.status(500).json({ status: 'error' }); }
};

const getRevenueReport = async (req, res) => {
    try {
        const { data: topups } = await supabase.from('topup_transactions').select('gross_amount').eq('status', 'SETTLEMENT');
        const totalGmv = topups ? topups.reduce((a, b) => a + Number(b.gross_amount), 0) : 0;
        // Platform fee is 5%
        const revenue = totalGmv * 0.05;
        res.json({ status: 'success', data: { platform_revenue: revenue } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

const getRecentWithdrawals = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('withdrawals')
            .select('*, creators(nama_lengkap)')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        res.json({ status: 'success', data });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

module.exports = {
   getPendingWithdrawals, approveWithdrawal, rejectWithdrawal, getFailedWithdrawals,
   calculateTax, getGmvReport, getRevenueReport, getRecentWithdrawals
};
