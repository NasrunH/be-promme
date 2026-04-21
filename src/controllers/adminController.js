const supabase = require('../config/supabase');
const { logAudit } = require('../utils/auditLogger');
const crypto = require('crypto');
const isIP = (str) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str);

const listUsers = async (req, res) => {
    try {
        const { data: users, error } = await supabase.from('users').select(`
            id, email, role, status, created_at,
            creators ( * ),
            brands ( * )
        `);

        if (error) throw new Error(error.message || JSON.stringify(error));

        res.json({ status: 'success', data: users });
    } catch (e) {
        console.error("List Users Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal menarik data pengguna' });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const body = req.body || {};
        const query = req.query || {};
        const params = req.params || {};

        const rawStatus = body.status || query.status;
        if (!rawStatus) return res.status(400).json({ status: 'error', message: 'Status wajib diisi' });

        const status = String(rawStatus).toUpperCase();
        const userId = params.id || params.user_id || params.userId || body.id || body.user_id;

        if (!userId) {
            return res.status(400).json({ status: 'error', message: 'ID User wajib diisi' });
        }

        const { data: oldUser, error: fetchErr } = await supabase.from('users').select('status, role, brands(id)').eq('id', userId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID User tidak valid (Bukan UUID)' });
            throw new Error(`DB Error (Fetch): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }
        if (!oldUser) return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });

        // Update dieksekusi murni tanpa .select() untuk menghindari RLS false-positive block
        const { error: updErr } = await supabase.from('users').update({ status }).eq('id', userId);
        if (updErr) throw new Error(`DB Error (Update): ${updErr.message || JSON.stringify(updErr)}`);

        // Cascade Effect: If suspending a Brand, stop active campaigns
        if (status === 'SUSPENDED' && oldUser?.role === 'BRAND') {
            const brandList = Array.isArray(oldUser.brands) ? oldUser.brands : (oldUser.brands ? [oldUser.brands] : []);
            const brandIds = brandList.map(b => b?.id).filter(Boolean);

            if (brandIds.length > 0) {
                const { error: cascadeErr } = await supabase.from('campaigns').update({ status: 'DIBATALKAN' }).in('brand_id', brandIds).eq('status', 'AKTIF');
                if (cascadeErr) console.error("Cascade Brand Suspension Error:", cascadeErr);
            }
        }

        try {
            await logAudit(req, 'UPDATE_USER_STATUS', 'USER', userId, { status: oldUser?.status }, { status });
        } catch (logErr) {
            console.error("Audit log error (diabaikan):", logErr);
        }

        res.json({ status: 'success', message: `Status pengguna diupdate menjadi ${status}` });
    } catch (e) {
        console.error("Update User Status Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal mengupdate status pengguna' });
    }
};

const reviewKyc = async (req, res) => {
    try {
        const body = req.body || {};
        const query = req.query || {};
        const params = req.params || {};

        const rawStatus = body.status || query.status;
        if (!rawStatus) return res.status(400).json({ status: 'error', message: 'Status KYC wajib diisi' });

        const status = String(rawStatus).toUpperCase();
        const creatorId = params.creator_id || params.id || body.creator_id || body.id;

        if (!creatorId) {
            return res.status(400).json({ status: 'error', message: 'ID Creator wajib diisi' });
        }

        const { data: oldCreator, error: fetchErr } = await supabase.from('creators').select('kyc_status').eq('id', creatorId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID Creator tidak valid' });
            throw new Error(`DB Error (Fetch KYC): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }
        if (!oldCreator) return res.status(404).json({ status: 'error', message: 'Creator tidak ditemukan' });

        const { error: updErr } = await supabase.from('creators').update({ kyc_status: status }).eq('id', creatorId);
        if (updErr) throw new Error(`DB Error (Update KYC): ${updErr.message || JSON.stringify(updErr)}`);

        try {
            await logAudit(req, 'REVIEW_KYC', 'CREATOR', creatorId, { kyc_status: oldCreator?.kyc_status }, { kyc_status: status });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: `KYC ${status}` });
    } catch (e) {
        console.error("Review KYC Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal mereview KYC' });
    }
};

const updatePlatformFee = async (req, res) => {
    try {
        try {
            await logAudit(req, 'UPDATE_PLATFORM_FEE', 'SYSTEM', 'GLOBAL', null, req.body || {});
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }
        res.json({ status: 'success', message: 'Platform fee updated' });
    } catch (e) {
        console.error("Update Platform Fee Error:", e);
        res.status(500).json({ status: 'error', message: 'Gagal mengupdate platform fee' });
    }
};

const updateCampaignStatus = async (req, res) => {
    try {
        const body = req.body || {};
        const query = req.query || {};
        const params = req.params || {};

        const rawStatus = body.status || query.status;
        if (!rawStatus) return res.status(400).json({ status: 'error', message: 'Status wajib diisi' });

        const status = String(rawStatus).toUpperCase();
        const campaignId = params.campaign_id || params.campaignId || params.id || body.campaign_id || body.id;

        if (!campaignId) {
            return res.status(400).json({ status: 'error', message: 'ID Campaign wajib diisi' });
        }

        const { data: oldCampaign, error: fetchErr } = await supabase.from('campaigns').select('status').eq('campaign_id', campaignId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID Campaign tidak valid' });
            throw new Error(`DB Error (Fetch Campaign): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }

        if (!oldCampaign) return res.status(404).json({ status: 'error', message: 'Campaign tidak ditemukan' });

        const { error: updErr } = await supabase.from('campaigns').update({ status }).eq('campaign_id', campaignId);
        if (updErr) throw new Error(`DB Error (Update Campaign): ${updErr.message || JSON.stringify(updErr)}`);

        try {
            await logAudit(req, 'UPDATE_CAMPAIGN_STATUS', 'CAMPAIGN', campaignId, { status: oldCampaign?.status }, { status });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: `Status campaign diupdate menjadi ${status}` });
    } catch (e) {
        console.error("Update Campaign Status Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal mengupdate status campaign' });
    }
};

const getAnomalies = async (req, res) => {
    try {
        const anomalies = [];

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // 1. Velocity Anomaly
        const { data: velocityData } = await supabase.from('submissions').select('creator_id, creators(nama_lengkap)').gt('submitted_at', oneHourAgo);
        const counts = {};
        velocityData?.forEach(s => {
            counts[s.creator_id] = (counts[s.creator_id] || { count: 0, name: s.creators?.nama_lengkap });
            counts[s.creator_id].count++;
        });
        Object.keys(counts).forEach(id => {
            if (counts[id].count > 5) {
                anomalies.push({ type: 'VELOCITY', entity_id: id, name: counts[id].name, description: `Terlalu banyak submission (${counts[id].count}) dalam 1 jam terakhir.`, risk: 'HIGH' });
            }
        });

        // 2. High Rejection Rate
        const { data: rejectionData } = await supabase.from('submissions').select('creator_id, status, creators(nama_lengkap)').gte('created_at', sevenDaysAgo);
        const userStats = {};
        rejectionData?.forEach(s => {
            if (!userStats[s.creator_id]) userStats[s.creator_id] = { total: 0, rejected: 0, name: s.creators?.nama_lengkap };
            userStats[s.creator_id].total++;
            if (s.status === 'DITOLAK') userStats[s.creator_id].rejected++;
        });
        Object.keys(userStats).forEach(id => {
            const stats = userStats[id];
            if (stats.total >= 3 && (stats.rejected / stats.total) > 0.6) {
                anomalies.push({ type: 'SPAM', entity_id: id, name: stats.name, description: `Tingkat penolakan sangat tinggi (${Math.round((stats.rejected / stats.total) * 100)}%). Indikasi content spam.`, risk: 'MEDIUM' });
            }
        });

        // 3. Ghost Revenue
        const { data: ghostData } = await supabase.from('wallets').select('wallet_id, balance, creators(id, nama_lengkap, kyc_status)').gt('balance', 1000000);
        ghostData?.forEach(w => {
            if (w.creators?.kyc_status !== 'VERIFIED') {
                anomalies.push({ type: 'GHOST_REVENUE', entity_id: w.wallet_id, name: w.creators?.nama_lengkap, description: `Saldo besar (> Rp 1jt) namun KYC belum terverifikasi (${w.creators?.kyc_status}).`, risk: 'HIGH' });
            }
        });

        // 4. Content Reuse
        const { data: contentData } = await supabase.from('submissions').select('content_url, creator_id, creators(nama_lengkap)').gte('created_at', sevenDaysAgo);
        const urlToCreator = {};
        contentData?.forEach(s => {
            if (!s.content_url) return;
            if (!urlToCreator[s.content_url]) urlToCreator[s.content_url] = [];
            urlToCreator[s.content_url].push({ id: s.creator_id, name: s.creators?.nama_lengkap });
        });
        Object.entries(urlToCreator).forEach(([url, creators]) => {
            if (creators.length > 1) {
                const names = [...new Set(creators.map(c => c.name))];
                anomalies.push({
                    type: 'CONTENT_REUSE',
                    entity_id: url,
                    name: 'Duplicate Content URL',
                    description: `URL ini digunakan oleh ${creators.length} creator berbeda (7 Hari Terakhir). Indikasi plagiarisme/reposting.`,
                    involved_actors: names,
                    risk: 'HIGH'
                });
            }
        });

        // 5. IP Clustering
        const { data: auditData } = await supabase.from('audit_logs').select('ip_address, actor_id').eq('action', 'SUBMIT_CONTENT').gte('created_at', sevenDaysAgo);
        const ipToAccounts = {};
        auditData?.forEach(log => {
            if (log.ip_address && log.actor_id) {
                if (!ipToAccounts[log.ip_address]) ipToAccounts[log.ip_address] = new Set();
                ipToAccounts[log.ip_address].add(log.actor_id);
            }
        });

        for (const ip of Object.keys(ipToAccounts)) {
            if (ipToAccounts[ip].size > 3) {
                const accountIds = Array.from(ipToAccounts[ip]);
                const { data: actorNames } = await supabase.from('creators').select('nama_lengkap').in('user_id', accountIds);
                const names = actorNames?.map(n => n.nama_lengkap) || [];

                anomalies.push({
                    type: 'IP_CLUSTER',
                    entity_id: ip,
                    name: `Cluster IP: ${ip}`,
                    involved_actors: names,
                    description: `Ditemukan ${ipToAccounts[ip].size} akun berbeda melakukan submission dari IP ini (7 Hari). Indikasi ternak akun.`,
                    risk: 'HIGH'
                });
            }
        }

        // 6. Brand Burn
        const { data: burnData } = await supabase.from('campaigns').select('campaign_id, nama_campaign, status, brands(user_id, nama_perusahaan, pic_name)').eq('status', 'DIBATALKAN').gte('updated_at', sevenDaysAgo);
        for (const camp of (burnData || [])) {
            const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.campaign_id);
            if (count > 10) {
                const brandObj = Array.isArray(camp.brands) ? camp.brands[0] : camp.brands;
                anomalies.push({
                    type: 'BRAND_BURN',
                    entity_id: brandObj?.user_id,
                    name: brandObj?.nama_perusahaan,
                    involved_actors: [brandObj?.pic_name].filter(Boolean),
                    description: `Campaign "${camp.nama_campaign}" dibatalkan dengan total ${count} submission. Indikasi budget baiting.`,
                    risk: 'MEDIUM'
                });
            }
        }

        // --- PART 2: LIST DATA FOR BROWSING ---
        const { data: wallets } = await supabase.from('wallets').select('wallet_id, balance, hold_balance, creators(nama_lengkap, users(id, email, role, status))');
        const { data: submissions } = await supabase.from('submissions').select('submission_id, views_tervalidasi, status, created_at, campaigns(nama_campaign), creators(nama_lengkap), content_url').order('created_at', { ascending: false }).limit(100);
        const { data: campaigns } = await supabase.from('campaigns').select('campaign_id, nama_campaign, status, budget_total, budget_tersisa, brands(nama_perusahaan, user_id, users(status))').order('created_at', { ascending: false });
        const { data: brandsList } = await supabase.from('brands').select('id, nama_perusahaan, pic_name, user_id, users(email, status)');

        res.json({
            status: 'success',
            data: {
                anomalies,
                lists: {
                    wallets: wallets || [],
                    submissions: submissions || [],
                    campaigns: campaigns || [],
                    brands: brandsList || []
                }
            }
        });
    } catch (e) {
        console.error("Get Anomalies Error:", e);
        res.status(500).json({ status: 'error', message: 'Gagal mendeteksi anomali fraud' });
    }
};

const holdWalletBalance = async (req, res) => {
    try {
        const params = req.params || {};
        const target = params.wallet_id || params.id;

        if (isIP(target)) {
            const { data: logs } = await supabase.from('audit_logs').select('actor_id').eq('ip_address', target).eq('action', 'SUBMIT_CONTENT');
            const userIds = [...new Set(logs?.map(l => l.actor_id))];

            if (!userIds.length) return res.status(404).json({ status: 'error', message: 'Tidak ada aktor ditemukan di IP ini' });

            const { data: creators } = await supabase.from('creators').select('id').in('user_id', userIds);
            const creatorIds = creators?.map(c => c.id) || [];

            if (!creatorIds.length) {
                return res.status(404).json({ status: 'error', message: 'Tidak ada wallet/creator terkait yang ditemukan di IP ini' });
            }

            const { data: wallets } = await supabase.from('wallets').select('*').in('creator_id', creatorIds);

            let successCount = 0;
            let skipCount = 0;

            for (const wallet of (wallets || [])) {
                try {
                    const balance = parseInt(wallet.balance) || 0;
                    if (balance <= 0) { skipCount++; continue; }

                    const { error: updErr } = await supabase.from('wallets').update({
                        balance: 0,
                        hold_balance: (parseInt(wallet.hold_balance) || 0) + balance,
                        version: (wallet.version || 0) + 1
                    }).eq('wallet_id', wallet.wallet_id);

                    if (updErr) throw updErr;

                    const { error: insErr } = await supabase.from('wallet_transactions').insert({
                        wallet_id: wallet.wallet_id,
                        type: 'HOLD',
                        amount: balance,
                        idempotency_key: crypto.randomUUID()
                    });

                    if (insErr) throw insErr;

                    successCount++;
                } catch (err) {
                    console.error(`Gagal hold wallet ${wallet.wallet_id}:`, err);
                    skipCount++;
                }
            }

            let usersSuspended = false;
            if (successCount > 0 && userIds.length > 0) {
                const { error: banErr } = await supabase.from('users').update({ status: 'SUSPENDED' }).in('id', userIds);
                if (!banErr) usersSuspended = true;
            }

            try {
                await logAudit(req, 'FREEZE_IP_CLUSTER', 'IP', target, { user_count: userIds.length }, { success: successCount, skipped: skipCount, users_suspended: usersSuspended });
            } catch (logErr) {
                console.error("Audit log error:", logErr);
            }

            return res.json({ status: 'success', message: `Cluster IP dibekukan. ${successCount} wallet diproses dan aktor di-suspend.` });
        }

        let { data: wallet, error: fetchErr } = await supabase.from('wallets').select('*').eq('wallet_id', target).maybeSingle();

        if (fetchErr || !wallet) {
            const { data: creatorWallet, error: creatorFetchErr } = await supabase.from('wallets').select('*').eq('creator_id', target).maybeSingle();
            if (!creatorFetchErr && creatorWallet) {
                wallet = creatorWallet;
            } else {
                return res.status(404).json({ status: 'error', message: `Wallet/Creator tidak ditemukan (ID: ${target})` });
            }
        }

        const currentBalance = parseInt(wallet.balance) || 0;
        if (currentBalance <= 0) return res.status(400).json({ status: 'error', message: `Hold gagal: Saldo aktif wallet ini sudah 0 atau kosong (Current: Rp ${currentBalance})` });

        const { error: updErr } = await supabase.from('wallets').update({
            balance: 0,
            hold_balance: (parseInt(wallet.hold_balance) || 0) + currentBalance,
            version: (wallet.version || 0) + 1
        }).eq('wallet_id', wallet.wallet_id);

        if (updErr) throw new Error(`DB Error (Update Wallet): ${updErr.message}`);

        const { error: insErr } = await supabase.from('wallet_transactions').insert({
            wallet_id: wallet.wallet_id,
            type: 'DISPUTE_HOLD',
            amount: currentBalance,
            idempotency_key: crypto.randomUUID()
        });

        if (insErr) throw new Error(`DB Error (Insert Tx): ${insErr.message}`);

        try {
            await logAudit(req, 'HOLD_WALLET_BALANCE', 'WALLET', wallet.wallet_id, { balance: currentBalance }, { balance: 0, hold_balance: (parseInt(wallet.hold_balance) || 0) + currentBalance });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: 'Saldo berhasil dibekukan untuk investigasi' });
    } catch (e) {
        console.error("Hold Wallet Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal membekukan saldo' });
    }
};

const releaseWalletBalance = async (req, res) => {
    try {
        const params = req.params || {};
        const target = params.wallet_id || params.id;

        let { data: wallet, error: fetchErr } = await supabase.from('wallets').select('*').eq('wallet_id', target).maybeSingle();

        if (fetchErr || !wallet) {
            const { data: creatorWallet, error: creatorFetchErr } = await supabase.from('wallets').select('*').eq('creator_id', target).maybeSingle();
            if (!creatorFetchErr && creatorWallet) {
                wallet = creatorWallet;
            } else {
                return res.status(404).json({ status: 'error', message: `Wallet/Creator tidak ditemukan (ID: ${target})` });
            }
        }

        const currentHold = parseInt(wallet.hold_balance) || 0;

        if (currentHold <= 0) return res.status(400).json({ status: 'error', message: 'Tidak ada saldo tertahan untuk dibebaskan' });

        const { error: updErr } = await supabase.from('wallets').update({
            balance: (parseInt(wallet.balance) || 0) + currentHold,
            hold_balance: 0,
            version: (wallet.version || 0) + 1
        }).eq('wallet_id', wallet.wallet_id);

        if (updErr) throw new Error(`DB Error (Update Wallet): ${updErr.message}`);

        const { error: insErr } = await supabase.from('wallet_transactions').insert({
            wallet_id: wallet.wallet_id,
            type: 'DISPUTE_RELEASE',
            amount: currentHold,
            idempotency_key: crypto.randomUUID()
        });

        if (insErr) throw new Error(`DB Error (Insert Tx): ${insErr.message}`);

        try {
            await logAudit(req, 'RELEASE_WALLET_BALANCE', 'WALLET', wallet.wallet_id, { hold_balance: currentHold }, { balance: (parseInt(wallet.balance) || 0) + currentHold, hold_balance: 0 });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: 'Saldo berhasil dibebaskan' });
    } catch (e) {
        console.error("Release Wallet Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal membebaskan saldo' });
    }
};

const invalidateSubmission = async (req, res) => {
    try {
        const body = req.body || {};
        const params = req.params || {};
        const submissionId = params.submission_id || params.id || body.submission_id || body.id;

        if (!submissionId) {
            return res.status(400).json({ status: 'error', message: 'ID Submission wajib diisi' });
        }

        const { data: oldSub, error: fetchErr } = await supabase.from('submissions').select('status').eq('submission_id', submissionId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID Submission tidak valid' });
            throw new Error(`DB Error (Fetch): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }
        if (!oldSub) return res.status(404).json({ status: 'error', message: 'Submission tidak ditemukan' });

        if (oldSub.status === 'SELESAI' || oldSub.status === 'SIAP_BAYAR') {
            return res.status(400).json({ status: 'error', message: `Tolak gagal: Dana submission ini sudah (${oldSub.status}). Gunakan fitur Hold Wallet.` });
        }

        const { error: updErr } = await supabase.from('submissions').update({
            status: 'DITOLAK',
            alasan_penolakan: 'Fraud detected / Admin Force Invalidation'
        }).eq('submission_id', submissionId);

        if (updErr) throw new Error(`DB Error (Update): ${updErr.message || JSON.stringify(updErr)}`);

        try {
            await logAudit(req, 'INVALIDATE_SUBMISSION', 'SUBMISSION', submissionId, { status: oldSub?.status }, { status: 'DITOLAK' });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: 'Submission ditolak paksa' });
    } catch (e) {
        console.error("Invalidate Submission Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal menolak submission' });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        res.json({ status: 'success', data });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

module.exports = {
    listUsers, updateUserStatus, reviewKyc, updatePlatformFee, updateCampaignStatus,
    getAnomalies, holdWalletBalance, releaseWalletBalance, invalidateSubmission, getAuditLogs
};