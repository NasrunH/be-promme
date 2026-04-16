const supabase = require('../config/supabase');
const crypto = require('crypto');

// 1. PAYMENT WEBHOOK (Top-up)
const handlePaymentWebhook = async (req, res) => {
  try {
    const { order_id, transaction_status, gross_amount, signature_key } = req.body;

    // [TODO] Validate Signature Key (Midtrans Requirement)
    // const hash = crypto.createHash('sha512').update(order_id + status_code + gross_amount + server_key).digest('hex');

    if (transaction_status === 'settlement') {
        // Find topup transaction
        const { data: topup } = await supabase.from('topup_transactions').select('*').eq('order_id', order_id).single();
        
        if (topup && topup.status !== 'SETTLEMENT') {
            // 1. Update Topup Status
            await supabase.from('topup_transactions').update({ status: 'SETTLEMENT' }).eq('topup_id', topup.topup_id);
            
            // 2. Activate Campaign & Add Budget
            const amount = parseInt(gross_amount);
            await supabase.rpc('activate_campaign_with_budget', { 
                camp_id: topup.campaign_id, 
                add_budget: amount 
            });
        }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Payment Webhook Error:', error);
    res.status(500).send('Error');
  }
};

// 2. PAYOUT WEBHOOK (Withdrawal)
const handlePayoutWebhook = async (req, res) => {
  try {
    const { status, reference_no, amount } = req.body;

    if (status === 'processed') {
        const { data: wd } = await supabase.from('withdrawals').select('*').eq('withdrawal_id', reference_no).single();

        if (wd && wd.status !== 'PROCESSED') {
            // Update status
            await supabase.from('withdrawals').update({ status: 'PROCESSED' }).eq('withdrawal_id', wd.withdrawal_id);
            
            // Deduct from wallet balance (In Iris, money is usually deducted at the start, 
            // but here we might need to finalize ledger)
            // Logic depends on Iris implementation details.
        }
    }

    res.status(200).send('OK');
  } catch (error) {
    res.status(500).send('Error');
  }
};

module.exports = { handlePaymentWebhook, handlePayoutWebhook };
