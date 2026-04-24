const cron = require('node-cron');
const supabase = require('../config/supabase');

/**
 * Daily Scheduler: Menjalankan tugas pada pukul 00:00 WIB setiap hari
 * 0 0 * * * -> Menit 0, Jam 0, Setiap hari
 */
const initCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('--- Running Daily Scheduler: Resetting daily_spent_today ---');
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ daily_spent_today: 0 })
        .not('daily_spent_today', 'eq', 0); // Hanya update yang tidak 0 untuk efisiensi

      if (error) {
        console.error('Error resetting daily_spent_today:', error);
      } else {
        console.log('Successfully reset daily_spent_today for all campaigns.');
      }
    } catch (err) {
      console.error('Unexpected error in Cron Job:', err);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
};

module.exports = { initCronJobs };
