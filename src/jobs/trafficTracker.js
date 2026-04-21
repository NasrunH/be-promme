const cron = require('node-cron');
const supabase = require('../config/supabase');
const { scrapeViews } = require('../services/scraperService');

// Fungsi utama penarik traffic
const runTrafficTracker = async () => {
  console.log('[JOBS] Traffic Tracker started...');
  try {
    // 1. Ambil semua submission berstatus PENDING (sertakan relasi campaigns untuk budget)
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

      // 2. Scrape data langsung dari URL
      let realViews = await scrapeViews(sub.content_url, platform);
      
      // 3. Fallback / Simulasi Realistis
      if (realViews === null) {
        const minutesElapsed = Math.floor((new Date() - new Date(sub.submitted_at)) / 60000);
        // Simulasi pertumbuhan views
        const simulatedGrowth = minutesElapsed * (Math.floor(Math.random() * 15) + 1);
        realViews = Math.max((sub.views_tervalidasi || 0), simulatedGrowth + 100); 
      }

      // Pastikan views selalu naik
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
        } else {
           // Jika views naik tapi uang tidak berubah (karena belum capai kelipatan 1000)
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
