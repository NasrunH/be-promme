const cron = require('node-cron');
const supabase = require('../config/supabase');
const { scrapeViews } = require('../services/scraperService');

let isRunning = false;
let lastRunTimestamp = 0;

// Fungsi utama penarik traffic
const runTrafficTracker = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    // 1. Ambil Pengaturan Frekuensi (Default 1 menit jika tidak ada)
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'tracker_frequency')
      .maybeSingle();
    
    const frequency = parseInt(settings?.value || '1');
    const now = Date.now();

    // Cek apakah sudah waktunya jalan berdasarkan frekuensi
    if (now - lastRunTimestamp < (frequency * 60000)) {
       isRunning = false;
       return;
    }

    console.log(`[JOBS] Traffic Tracker started (Frequency: ${frequency} min)...`);
    lastRunTimestamp = now;

    // 2. Ambil semua submission berstatus PENDING (sertakan relasi campaigns untuk budget)
    const { data: submissions, error: subErr } = await supabase
      .from('submissions')
      .select('submission_id, campaign_id, content_url, views_tervalidasi, net_earning, status, submitted_at, campaigns(campaign_id, platform, komisi_per_view, budget_tersisa)')
      .eq('status', 'PENDING');

    if (subErr || !submissions || submissions.length === 0) {
      console.log('[JOBS] Tidak ada submission aktif untuk di-track.');
      return;
    }

    for (const sub of submissions) {
      if (!sub.campaigns) continue;
      
      const campaign = Array.isArray(sub.campaigns) ? sub.campaigns[0] : sub.campaigns;
      const komisiPerSeribuView = campaign.komisi_per_view;
      const platform = campaign.platform;
      let currentBudgetTersisa = campaign.budget_tersisa || 0;
      
      // Jika budget sudah 0, jangan update nilai uang lagi
      if (currentBudgetTersisa <= 0) continue;

      // 2. Scrape data langsung dari URL (API)
      let realViews = await scrapeViews(sub.content_url, platform);
      
      // Jika gagal mengambil data (API limit atau URL salah), jangan lakukan update views (biarkan nilai lama)
      if (realViews === null) {
        console.log(`[JOBS] Skipping ${sub.submission_id}: Gagal mengambil real views dari API.`);
        continue;
      }

      // Pastikan views selalu naik (untuk menghindari fluktuasi API)
      if (realViews > (sub.views_tervalidasi || 0)) {
        
        // PERHITUNGAN BARU: komisi per 1000 views (CPM)
        let grossEarning = Math.floor((realViews / 1000) * komisiPerSeribuView);
        let netEarning = grossEarning; // Asumsi 0% fee sementara
        
        const oldNetEarning = sub.net_earning || 0;
        let deltaEarning = netEarning - oldNetEarning;

        let campaignStatusUpdate = null;

        // Jika ada perubahan uang (Naik/Turun)
        if (deltaEarning !== 0) {
          if (deltaEarning > 0) {
            // Pendapatan naik, cek apakah budget masih cukup
            if (deltaEarning > currentBudgetTersisa) {
              deltaEarning = currentBudgetTersisa;
              netEarning = oldNetEarning + deltaEarning;
              grossEarning = netEarning;
              currentBudgetTersisa = 0;
              campaignStatusUpdate = 'SELESAI_BUDGET';
            } else {
              currentBudgetTersisa -= deltaEarning;
            }
          } else {
            // Pendapatan secara logis turun (Koreksi dari bug sistem lama yang menghitung per-view)
            // Refund kembali uang ke budget
            currentBudgetTersisa += Math.abs(deltaEarning);
            if (campaign.status === 'SELESAI_BUDGET' && currentBudgetTersisa > 0) {
               campaignStatusUpdate = 'AKTIF';
            }
          }

          // Update Data Submission
          const { error: updateErr } = await supabase
            .from('submissions')
            .update({
              views_tervalidasi: realViews,
              gross_earning: grossEarning,
              net_earning: netEarning,
              updated_at: new Date().toISOString()
            })
            .eq('submission_id', sub.submission_id);

          if (!updateErr) {
            console.log(`[JOBS] Updated ${sub.submission_id} -> ${realViews} views. Earned: Rp${netEarning} (Delta: Rp${deltaEarning})`);
            
            let campaignUpdateData = { budget_tersisa: currentBudgetTersisa };
            if (campaignStatusUpdate) {
              campaignUpdateData.status = campaignStatusUpdate;
            }

            await supabase
              .from('campaigns')
              .update(campaignUpdateData)
              .eq('campaign_id', campaign.campaign_id);
          }
        } else if (realViews > (sub.views_tervalidasi || 0)) {
           // Jika views naik (tapi tidak merubah saldo karena belum kelipatan 1000)
           // tetap update views agar di dashboard terlihat progressnya
           await supabase
            .from('submissions')
            .update({ views_tervalidasi: realViews, updated_at: new Date().toISOString() })
            .eq('submission_id', sub.submission_id);
        }
      }
    }
    console.log('[JOBS] Traffic Tracker finished successfully.');

  } catch (error) {
    console.error('[JOBS] Traffic Tracker Error:', error);
  }
};

// Atur Cron Job (Jalan setiap 1 Menit)
const initTrafficTracker = () => {
  cron.schedule('* * * * *', runTrafficTracker);
  console.log('[CRON] Traffic Tracker Job initialized. Runs every minute.');
};

module.exports = { initTrafficTracker, runTrafficTracker };
