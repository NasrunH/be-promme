const supabaseAdmin = require('../config/supabaseAdmin');
const { logAudit } = require('../utils/auditLogger');
const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const isIP = (str) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str);

/**
 * Get all users dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: email, nama
 * @query {string} status - Filter: ACTIVE, INACTIVE, SUSPENDED
 * @query {string} role - Filter: ADMIN, BRAND, CREATOR, FINANCE
 * @query {string} sort - Sort: created_at, -created_at, email, -email
 */
const createUser = async (req, res) => {
    try {
        const { email, password, role, nama_lengkap, nama_perusahaan, pic_name, phone_number } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ status: 'error', message: 'Email, password, dan role wajib diisi' });
        }

        const validRoles = ['ADMIN', 'FINANCE', 'BRAND', 'CREATOR'];
        const upperRole = role.toUpperCase();
        if (!validRoles.includes(upperRole)) {
            return res.status(400).json({ status: 'error', message: `Role tidak valid. Pilih: ${validRoles.join(', ')}` });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .insert([{ email, password_hash: passwordHash, role: upperRole, status: 'ACTIVE' }])
            .select().single();

        if (userError) {
            if (userError.code === '23505') {
                return res.status(400).json({ status: 'error', message: 'Email sudah digunakan' });
            }
            return res.status(400).json({ status: 'error', message: userError.message });
        }

        const userId = user.id;

        if (upperRole === 'CREATOR' && nama_lengkap) {
            const { data: creator, error: creatorError } = await supabaseAdmin
                .from('creators')
                .insert([{ user_id: userId, nama_lengkap }])
                .select().single();

            if (creatorError) {
                await supabaseAdmin.from('users').delete().eq('id', userId);
                return res.status(400).json({ status: 'error', message: 'Gagal membuat profil creator' });
            }

            const { error: walletError } = await supabaseAdmin
                .from('wallets')
                .insert([{ creator_id: creator.id }]);

            if (walletError) {
                await supabaseAdmin.from('creators').delete().eq('id', creator.id);
                await supabaseAdmin.from('users').delete().eq('id', userId);
                return res.status(400).json({ status: 'error', message: 'Gagal membuat wallet creator' });
            }
        }

        if (upperRole === 'BRAND') {
            if (!nama_perusahaan || !pic_name) {
                await supabaseAdmin.from('users').delete().eq('id', userId);
                return res.status(400).json({ status: 'error', message: 'Untuk role Brand, nama_perusahaan dan pic_name wajib diisi' });
            }

            const { error: brandError } = await supabaseAdmin
                .from('brands')
                .insert([{ user_id: userId, nama_perusahaan, pic_name, phone_number }]);

            if (brandError) {
                await supabaseAdmin.from('users').delete().eq('id', userId);
                return res.status(400).json({ status: 'error', message: 'Gagal membuat profil brand' });
            }
        }

        try {
            await logAudit(req, 'CREATE_USER', 'USER', userId, null, { email, role: upperRole });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.status(201).json({ status: 'success', message: `User ${upperRole} berhasil dibuat`, data: { user_id: userId } });
    } catch (e) {
        console.error("Create User Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal membuat pengguna baru' });
    }
};

const listUsers = async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const searchTerm = req.query.search ? req.query.search.trim() : '';
        const allowedFilters = ['status', 'role', 'kyc_status'];
        const filters = parseFilters(req.query, allowedFilters);

        // Build query
        let query = supabaseAdmin.from('users').select(`
            id, email, role, status, created_at,
            creators ( id, nama_lengkap, nik, npwp, ktp_image_url, selfie_image_url, kyc_status, creator_bank_accounts ( bank_code, account_number, account_name, status ) ),
            brands ( id, nama_perusahaan, pic_name, phone_number )
        `, { count: 'exact' });

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (key === 'kyc_status') {
                // Filter on joined creators table
                query = query.eq('creators.kyc_status', value);
            } else {
                query = query.eq(key, value);
            }
        });

        // Apply search (case-insensitive email)
        if (searchTerm) {
            query = query.or(`email.ilike.%${searchTerm}%`);
        }

        // Apply sorting
        const sortField = req.query.sort || '-created_at';
        const [field, direction] = sortField.startsWith('-') 
            ? [sortField.substring(1), 'desc'] 
            : [sortField, 'asc'];
        query = query.order(field, { ascending: direction === 'asc' });

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: users, error, count } = await query;

        if (error) throw new Error(error.message || JSON.stringify(error));

        const response = formatPaginationResponse(users || [], count || 0, page, limit);
        res.json({ status: 'success', ...response });
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

        const { data: oldUser, error: fetchErr } = await supabaseAdmin.from('users').select('status, role, brands(id)').eq('id', userId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID User tidak valid (Bukan UUID)' });
            throw new Error(`DB Error (Fetch): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }
        if (!oldUser) return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });

        // Update dieksekusi murni tanpa .select() untuk menghindari RLS false-positive block
        const { error: updErr } = await supabaseAdmin.from('users').update({ status }).eq('id', userId);
        if (updErr) throw new Error(`DB Error (Update): ${updErr.message || JSON.stringify(updErr)}`);

        // Cascade Effect: If suspending a Brand, stop active campaigns
        if (status === 'SUSPENDED' && oldUser?.role === 'BRAND') {
            const brandList = Array.isArray(oldUser.brands) ? oldUser.brands : (oldUser.brands ? [oldUser.brands] : []);
            const brandIds = brandList.map(b => b?.id).filter(Boolean);

            if (brandIds.length > 0) {
                const { error: cascadeErr } = await supabaseAdmin.from('campaigns').update({ status: 'DIBATALKAN' }).in('brand_id', brandIds).eq('status', 'AKTIF');
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

        const { data: oldCreator, error: fetchErr } = await supabaseAdmin.from('creators').select('kyc_status').eq('id', creatorId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID Creator tidak valid' });
            throw new Error(`DB Error (Fetch KYC): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }
        if (!oldCreator) return res.status(404).json({ status: 'error', message: 'Creator tidak ditemukan' });

        const { error: updErr } = await supabaseAdmin.from('creators').update({ kyc_status: status }).eq('id', creatorId);
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

        const { data: oldCampaign, error: fetchErr } = await supabaseAdmin.from('campaigns').select('status').eq('campaign_id', campaignId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID Campaign tidak valid' });
            throw new Error(`DB Error (Fetch Campaign): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }

        if (!oldCampaign) return res.status(404).json({ status: 'error', message: 'Campaign tidak ditemukan' });

        const { error: updErr } = await supabaseAdmin.from('campaigns').update({ status }).eq('campaign_id', campaignId);
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
        const { data: velocityData } = await supabaseAdmin.from('submissions').select('creator_id, creators(nama_lengkap)').gt('submitted_at', oneHourAgo);
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
        const { data: rejectionData } = await supabaseAdmin.from('submissions').select('creator_id, status, creators(nama_lengkap)').gte('created_at', sevenDaysAgo);
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
        const { data: ghostData } = await supabaseAdmin.from('wallets').select('wallet_id, balance, creators(id, nama_lengkap, kyc_status)').gt('balance', 1000000);
        ghostData?.forEach(w => {
            if (w.creators?.kyc_status !== 'VERIFIED') {
                anomalies.push({ type: 'GHOST_REVENUE', entity_id: w.wallet_id, name: w.creators?.nama_lengkap, description: `Saldo besar (> Rp 1jt) namun KYC belum terverifikasi (${w.creators?.kyc_status}).`, risk: 'HIGH' });
            }
        });

        // 4. Content Reuse
        const { data: contentData } = await supabaseAdmin.from('submissions').select('content_url, creator_id, creators(nama_lengkap)').gte('created_at', sevenDaysAgo);
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
        const { data: auditData } = await supabaseAdmin.from('audit_logs').select('ip_address, actor_id').eq('action', 'SUBMIT_CONTENT').gte('created_at', sevenDaysAgo);
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
                const { data: actorNames } = await supabaseAdmin.from('creators').select('nama_lengkap').in('user_id', accountIds);
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
        const { data: burnData } = await supabaseAdmin.from('campaigns').select('campaign_id, nama_campaign, status, brands(user_id, nama_perusahaan, pic_name)').eq('status', 'DIBATALKAN').gte('updated_at', sevenDaysAgo);
        for (const camp of (burnData || [])) {
            const { count } = await supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.campaign_id);
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
        const { data: wallets, error: walErr } = await supabaseAdmin.from('wallets').select('wallet_id, balance, hold_balance, creators(nama_lengkap, users(id, email, role, status))');
        if (walErr) console.error("[GET_ANOMALIES] Wallet Error:", walErr);

        const { data: submissions, error: subErr } = await supabaseAdmin.from('submissions').select('submission_id, views_tervalidasi, status, submitted_at, campaigns(nama_campaign), creators(nama_lengkap), content_url').order('submitted_at', { ascending: false }).limit(100);
        if (subErr) console.error("[GET_ANOMALIES] Submission Error:", subErr);

        const { data: campaigns, error: campErr } = await supabaseAdmin.from('campaigns').select('campaign_id, nama_campaign, status, budget_total, budget_tersisa, brands(nama_perusahaan, user_id, users(status))').order('created_at', { ascending: false });
        if (campErr) console.error("[GET_ANOMALIES] Campaign Error:", campErr);

        const { data: brandsList, error: brandErr } = await supabaseAdmin.from('brands').select('id, nama_perusahaan, pic_name, user_id, users(email, status)');
        if (brandErr) console.error("[GET_ANOMALIES] Brand Error:", brandErr);

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
            const { data: logs } = await supabaseAdmin.from('audit_logs').select('actor_id').eq('ip_address', target).eq('action', 'SUBMIT_CONTENT');
            const userIds = [...new Set(logs?.map(l => l.actor_id))];

            if (!userIds.length) return res.status(404).json({ status: 'error', message: 'Tidak ada aktor ditemukan di IP ini' });

            const { data: creators } = await supabaseAdmin.from('creators').select('id').in('user_id', userIds);
            const creatorIds = creators?.map(c => c.id) || [];

            if (!creatorIds.length) {
                return res.status(404).json({ status: 'error', message: 'Tidak ada wallet/creator terkait yang ditemukan di IP ini' });
            }

            const { data: wallets } = await supabaseAdmin.from('wallets').select('*').in('creator_id', creatorIds);

            let successCount = 0;
            let skipCount = 0;

            for (const wallet of (wallets || [])) {
                try {
                    const balance = parseInt(wallet.balance) || 0;
                    if (balance <= 0) { skipCount++; continue; }

                    const { error: updErr } = await supabaseAdmin.from('wallets').update({
                        balance: 0,
                        hold_balance: (parseInt(wallet.hold_balance) || 0) + balance,
                        version: (wallet.version || 0) + 1
                    }).eq('wallet_id', wallet.wallet_id);

                    if (updErr) throw updErr;

                    const { error: insErr } = await supabaseAdmin.from('wallet_transactions').insert({
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
                const { error: banErr } = await supabaseAdmin.from('users').update({ status: 'SUSPENDED' }).in('id', userIds);
                if (!banErr) usersSuspended = true;
            }

            try {
                await logAudit(req, 'FREEZE_IP_CLUSTER', 'IP', target, { user_count: userIds.length }, { success: successCount, skipped: skipCount, users_suspended: usersSuspended });
            } catch (logErr) {
                console.error("Audit log error:", logErr);
            }

            return res.json({ status: 'success', message: `Cluster IP dibekukan. ${successCount} wallet diproses dan aktor di-suspend.` });
        }

        let { data: wallet, error: fetchErr } = await supabaseAdmin.from('wallets').select('*').eq('wallet_id', target).maybeSingle();

        if (fetchErr || !wallet) {
            const { data: creatorWallet, error: creatorFetchErr } = await supabaseAdmin.from('wallets').select('*').eq('creator_id', target).maybeSingle();
            if (!creatorFetchErr && creatorWallet) {
                wallet = creatorWallet;
            } else {
                return res.status(404).json({ status: 'error', message: `Wallet/Creator tidak ditemukan (ID: ${target})` });
            }
        }

        const currentBalance = parseInt(wallet.balance) || 0;
        if (currentBalance <= 0) return res.status(400).json({ status: 'error', message: `Hold gagal: Saldo aktif wallet ini sudah 0 atau kosong (Current: Rp ${currentBalance})` });

        const { error: updErr } = await supabaseAdmin.from('wallets').update({
            balance: 0,
            hold_balance: (parseInt(wallet.hold_balance) || 0) + currentBalance,
            version: (wallet.version || 0) + 1
        }).eq('wallet_id', wallet.wallet_id);

        if (updErr) throw new Error(`DB Error (Update Wallet): ${updErr.message}`);

        const { error: insErr } = await supabaseAdmin.from('wallet_transactions').insert({
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

        let { data: wallet, error: fetchErr } = await supabaseAdmin.from('wallets').select('*').eq('wallet_id', target).maybeSingle();

        if (fetchErr || !wallet) {
            const { data: creatorWallet, error: creatorFetchErr } = await supabaseAdmin.from('wallets').select('*').eq('creator_id', target).maybeSingle();
            if (!creatorFetchErr && creatorWallet) {
                wallet = creatorWallet;
            } else {
                return res.status(404).json({ status: 'error', message: `Wallet/Creator tidak ditemukan (ID: ${target})` });
            }
        }

        const currentHold = parseInt(wallet.hold_balance) || 0;

        if (currentHold <= 0) return res.status(400).json({ status: 'error', message: 'Tidak ada saldo tertahan untuk dibebaskan' });

        const { error: updErr } = await supabaseAdmin.from('wallets').update({
            balance: (parseInt(wallet.balance) || 0) + currentHold,
            hold_balance: 0,
            version: (wallet.version || 0) + 1
        }).eq('wallet_id', wallet.wallet_id);

        if (updErr) throw new Error(`DB Error (Update Wallet): ${updErr.message}`);

        const { error: insErr } = await supabaseAdmin.from('wallet_transactions').insert({
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

const approveSubmission = async (req, res) => {
    try {
        const body = req.body || {};
        const params = req.params || {};
        const submissionId = params.submission_id || params.id || body.submission_id || body.id;

        if (!submissionId) {
            return res.status(400).json({ status: 'error', message: 'ID Submission wajib diisi' });
        }

        // 1. Ambil data submission + wallet creator
        const { data: sub, error: fetchErr } = await supabaseAdmin
            .from('submissions')
            .select('*, creators(id, wallets(*))')
            .eq('submission_id', submissionId)
            .maybeSingle();

        if (fetchErr || !sub) return res.status(404).json({ status: 'error', message: 'Submission tidak ditemukan' });
        if (sub.status === 'SELESAI') return res.status(400).json({ status: 'error', message: 'Submission ini sudah disetujui & dibayar' });
        if (sub.status === 'DITOLAK') return res.status(400).json({ status: 'error', message: 'Submission ini sudah ditolak' });

        const amountToPay = parseInt(sub.net_earning) || 0;
        const wallet = sub.creators?.wallets;

        if (!wallet) return res.status(404).json({ status: 'error', message: 'Dompet creator tidak ditemukan' });

        // 2. Update status submission jadi SELESAI
        const { error: updSubErr } = await supabaseAdmin
            .from('submissions')
            .update({ status: 'SELESAI', updated_at: new Date().toISOString() })
            .eq('submission_id', submissionId);
        
        if (updSubErr) throw updSubErr;

        // 3. Tambah Saldo ke Wallet
        const newBalance = (parseInt(wallet.balance) || 0) + amountToPay;
        const newTotalEarned = (parseInt(wallet.total_earned) || 0) + amountToPay;

        const { error: updWalletErr } = await supabaseAdmin
            .from('wallets')
            .update({ 
                balance: newBalance, 
                total_earned: newTotalEarned,
                last_transaction: new Date().toISOString(),
                version: (wallet.version || 0) + 1
            })
            .eq('wallet_id', wallet.wallet_id);
        
        if (updWalletErr) throw updWalletErr;

        // 4. Catat Transaksi Dompet
        const { error: txErr } = await supabaseAdmin.from('wallet_transactions').insert({
            wallet_id: wallet.wallet_id,
            type: 'EARNING',
            amount: amountToPay,
            reference_id: submissionId,
            idempotency_key: `PAYOUT-${submissionId}`
        });

        if (txErr) console.error("Gagal mencatat transaksi dompet (tapi saldo sudah masuk):", txErr);

        try {
            await logAudit(req, 'APPROVE_SUBMISSION', 'SUBMISSION', submissionId, { status: sub.status }, { status: 'SELESAI', payout: amountToPay });
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: 'Submission disetujui dan saldo telah dikirim ke dompet creator' });

    } catch (e) {
        console.error("Approve Submission Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal menyetujui submission' });
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

        const { data: oldSub, error: fetchErr } = await supabaseAdmin.from('submissions').select('status').eq('submission_id', submissionId).maybeSingle();

        if (fetchErr) {
            if (fetchErr.code === '22P02') return res.status(400).json({ status: 'error', message: 'Format ID Submission tidak valid' });
            throw new Error(`DB Error (Fetch): ${fetchErr.message || JSON.stringify(fetchErr)}`);
        }
        if (!oldSub) return res.status(404).json({ status: 'error', message: 'Submission tidak ditemukan' });

        if (oldSub.status === 'SELESAI' || oldSub.status === 'SIAP_BAYAR') {
            return res.status(400).json({ status: 'error', message: `Tolak gagal: Dana submission ini sudah (${oldSub.status}). Gunakan fitur Hold Wallet.` });
        }

        const { error: updErr } = await supabaseAdmin.from('submissions').update({
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

const getSettings = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('system_settings').select('*');
        if (error) throw error;
        
        // Convert array to object for easier use in frontend
        const settings = {};
        data.forEach(s => { settings[s.key] = s.value; });
        
        res.json({ status: 'success', data: settings });
    } catch (e) {
        console.error("Get Settings Error:", e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        const body = req.body || {};
        const updates = Object.entries(body);
        
        for (const [key, value] of updates) {
            const { error } = await supabaseAdmin
                .from('system_settings')
                .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
        }

        try {
            await logAudit(req, 'UPDATE_SYSTEM_SETTINGS', 'SYSTEM', 'GLOBAL', null, body);
        } catch (logErr) {
            console.error("Audit log error:", logErr);
        }

        res.json({ status: 'success', message: 'Pengaturan sistem berhasil diperbarui' });
    } catch (e) {
        console.error("Update Settings Error:", e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};

const getCampaignDetail = async (req, res) => {
    try {
        const { campaign_id } = req.params;

        const { data: campaign, error: campErr } = await supabaseAdmin
            .from('campaigns')
            .select('campaign_id, nama_campaign, status, budget_total, budget_tersisa, platform, komisi_per_view, tanggal_berakhir, min_konten_diterima, created_at, brands(id, nama_perusahaan, pic_name, user_id, users(email, status))')
            .eq('campaign_id', campaign_id)
            .maybeSingle();

        if (campErr) throw campErr;
        if (!campaign) return res.status(404).json({ status: 'error', message: 'Campaign tidak ditemukan' });

        const { data: participants, error: partErr } = await supabaseAdmin
            .from('campaign_participants')
            .select(`
                id, joined_at,
                creators ( id, nama_lengkap, kyc_status, users ( email, status ) )
            `)
            .eq('campaign_id', campaign_id);

        if (partErr) throw partErr;

        const { data: submissions, error: subErr } = await supabaseAdmin
            .from('submissions')
            .select('creator_id, status, views_tervalidasi, net_earning')
            .eq('campaign_id', campaign_id);

        if (subErr) throw subErr;

        const subsByCreator = {};
        (submissions || []).forEach(s => {
            if (!subsByCreator[s.creator_id]) {
                subsByCreator[s.creator_id] = { count: 0, views: 0, earning: 0, latest_status: '-' };
            }
            subsByCreator[s.creator_id].count++;
            subsByCreator[s.creator_id].views += (s.views_tervalidasi || 0);
            subsByCreator[s.creator_id].earning += (s.net_earning || 0);
            subsByCreator[s.creator_id].latest_status = s.status;
        });

        const enrichedParticipants = (participants || []).map(p => {
            const creatorData = Array.isArray(p.creators) ? p.creators[0] : p.creators;
            const userData = Array.isArray(creatorData?.users) ? creatorData?.users[0] : creatorData?.users;
            const stats = subsByCreator[creatorData?.id] || { count: 0, views: 0, earning: 0, latest_status: '-' };
            return {
                participant_id: p.id,
                creator_id: creatorData?.id,
                nama_lengkap: creatorData?.nama_lengkap || '-',
                email: userData?.email || '-',
                user_status: userData?.status || '-',
                kyc_status: creatorData?.kyc_status || '-',
                joined_at: p.joined_at,
                submission_count: stats.count,
                total_views: stats.views,
                total_earning: stats.earning,
                latest_submission_status: stats.latest_status
            };
        });

        const brandData = Array.isArray(campaign.brands) ? campaign.brands[0] : campaign.brands;

        res.json({
            status: 'success',
            data: {
                campaign: {
                    campaign_id: campaign.campaign_id,
                    nama_campaign: campaign.nama_campaign,
                    status: campaign.status,
                    budget_total: campaign.budget_total,
                    budget_tersisa: campaign.budget_tersisa,
                    platform: campaign.platform,
                    komisi_per_view: campaign.komisi_per_view,
                    tanggal_berakhir: campaign.tanggal_berakhir,
                    min_konten_diterima: campaign.min_konten_diterima,
                    created_at: campaign.created_at,
                    brand_name: brandData?.nama_perusahaan,
                    brand_email: brandData?.users?.email,
                    brand_status: brandData?.users?.status
                },
                participants: enrichedParticipants
            }
        });
    } catch (e) {
        console.error("Get Campaign Detail Error:", e);
        res.status(500).json({ status: 'error', message: e.message || 'Gagal mengambil detail campaign' });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        res.json({ status: 'success', data });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

module.exports = {
    listUsers, createUser, updateUserStatus, reviewKyc, updatePlatformFee, updateCampaignStatus,
    getAnomalies, holdWalletBalance, releaseWalletBalance, invalidateSubmission, getCampaignDetail,
    getAuditLogs, getSettings, updateSettings, approveSubmission
};
