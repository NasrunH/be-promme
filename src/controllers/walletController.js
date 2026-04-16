const supabase = require('../config/supabase');

// 1. GET WALLET BALANCE
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    
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
        balance: wallet.balance,
        pending_balance: wallet.pending_balance,
        total_earned: wallet.total_earned,
        total_withdrawn: wallet.total_withdrawn
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

    // Check Balance
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('creator_id', creator.id).single();
    if (wallet.balance < amount) {
        return res.status(400).json({ status: 'error', message: 'Saldo tidak mencukupi' });
    }

    // Insert Withdrawal record
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
        if (error.code === '23505') return res.status(400).json({ status: 'error', message: 'Request penarikan sudah ada (Idempotent)' });
        throw error;
    }

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

// 3. GET WALLET LEDGER
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: creator } = await supabase.from('creators').select('id').eq('user_id', userId).single();
    
    const { data: wallet } = await supabase.from('wallets').select('wallet_id').eq('creator_id', creator.id).single();
    if (!wallet) return res.status(404).json({ message: 'Dompet tidak ditemukan' });

    const { data: txs, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.wallet_id)
      .order('created_at', { ascending: false });

    if(error) throw error;
    res.status(200).json({ status: 'success', data: txs });
  } catch(error) {
     res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat transaksi' });
  }
};

module.exports = { getWalletBalance, requestWithdrawal, getWalletTransactions };
