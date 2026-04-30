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
const getLargePendingWithdrawals = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const searchTerm = req.query.search ? req.query.search.trim() : '';

        let query = supabase
            .from('withdrawals')
            .select('*, creators(id, nama_lengkap), bank_accounts(*, users(email))', { count: 'exact' })
            .eq('status', 'QUEUED')
            .gte('amount', 10000000);

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
                const bankInfo = Array.isArray(w.bank_accounts) ? w.bank_accounts[0] : w.bank_accounts;
                return creatorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       bankInfo?.account_name?.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }

        const response = formatPaginationResponse(result, count || 0, page, limit);
        res.json({ status: 'success', ...response });
    } catch (e) { 
        console.error('Get Large Pending Withdrawals Error:', e);
        res.status(500).json({ status: 'error', message: e.message }); 
    }
};

const approveWithdrawal = async (req, res) => {
    try {
        await supabase.from('withdrawals').update({ status: 'APPROVED' }).eq('withdrawal_id', req.params.id);
        res.json({ status: 'success', message: 'Withdrawal approved. Triggering Iris payout...' });
    } catch (e) { res.status(500).json({ status: 'error' }); }
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
            .select('*, creators(id, nama_lengkap), bank_accounts(*)', { count: 'exact' })
            .eq('status', 'FAILED');

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
                const failureReason = w.failure_reason || '';
                return creatorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       failureReason.toLowerCase().includes(searchTerm.toLowerCase());
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
   res.json({ status: 'success', data: { total_revenue: 0 } });
};

module.exports = {
   getLargePendingWithdrawals, approveWithdrawal, getFailedWithdrawals,
   calculateTax, getGmvReport, getRevenueReport
};
