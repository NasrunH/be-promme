const supabase = require('./src/config/supabase');
const crypto = require('crypto');

const CAMPAIGN_ID = '75e0a497-cf61-47fa-888c-14e5d5ec7d78';
const BRAND_ID = 'f2e0a497-cf61-47fa-888c-14e5d5ec7d11'; // Placeholder if needed
const PASSWORD_HASH = '$2b$10$KXnYOH0D0CFxLxIhf5bZTepSrHMKfm9cO/VLUBLb7kJWAktsvtIOm';

async function seed() {
  console.log('--- Seeding Comprehensive 360° Fraud Data ---');

  // --- 1. CONTENT REUSE SCENARIO ---
  const sharedUrl = `https://youtube.com/watch?v=shared_${Date.now()}`;
  const campaignIds = ['75e0a497-cf61-47fa-888c-14e5d5ec7d78', '859b0c1f-698e-4eda-8b5b-040aa00d377c'];
  for (let i = 1; i <= 2; i++) {
    const { data: user } = await supabase.from('users').insert({ email: `reuse_${i}_${Date.now()}@test.com`, password_hash: PASSWORD_HASH, role: 'CREATOR' }).select().single();
    const { data: creator } = await supabase.from('creators').insert({ user_id: user.id, nama_lengkap: `Reuse Creator ${i}`, kyc_status: 'VERIFIED' }).select().single();
    await supabase.from('wallets').insert({ creator_id: creator.id, balance: 10000 });
    await supabase.from('submissions').insert({ 
      campaign_id: campaignIds[i-1], 
      creator_id: creator.id, 
      content_url: sharedUrl, 
      status: 'PENDING' 
    });
  }
  console.log('Added Content Reuse scenario (2 creators, same URL, DIFFERENT campaigns).');

  // --- 2. IP CLUSTER SCENARIO ---
  const clusterIP = '1.2.3.4';
  for (let i = 1; i <= 5; i++) {
    const { data: user } = await supabase.from('users').insert({ email: `cluster_${i}_${Date.now()}@test.com`, password_hash: PASSWORD_HASH, role: 'CREATOR' }).select().single();
    const { data: creator } = await supabase.from('creators').insert({ user_id: user.id, nama_lengkap: `Cluster Member ${i}`, kyc_status: 'VERIFIED' }).select().single();
    await supabase.from('wallets').insert({ creator_id: creator.id, balance: 5000 });
    const { data: sub } = await supabase.from('submissions').insert({ campaign_id: CAMPAIGN_ID, creator_id: creator.id, content_url: `https://ig.com/p/clust${i}${Date.now()}`, status: 'PENDING' }).select().single();
    
    // Log audit for IP tracking
    await supabase.from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'CREATOR',
        action: 'SUBMIT_CONTENT',
        entity_type: 'SUBMISSION',
        entity_id: sub.submission_id,
        ip_address: clusterIP,
        new_data: { email: user.email }
    });
  }
  console.log('Added IP Cluster scenario (5 accounts, same IP).');

  // --- 3. BRAND BURN SCENARIO ---
  const { data: brandUser } = await supabase.from('users').insert({ email: `burned_brand_${Date.now()}@test.com`, password_hash: PASSWORD_HASH, role: 'BRAND' }).select().single();
  const { data: brand } = await supabase.from('brands').insert({ user_id: brandUser.id, nama_perusahaan: 'Burner Co.', pic_name: 'Mr. Burn' }).select().single();
  const { data: burnedCamp } = await supabase.from('campaigns').insert({
      brand_id: brand.id,
      nama_campaign: 'Bait Campaign',
      budget_total: 10000000,
      budget_tersisa: 5000000,
      platform: 'YOUTUBE',
      komisi_per_view: 500,
      min_watch_duration: 30,
      tanggal_mulai: new Date().toISOString(),
      tanggal_berakhir: new Date(Date.now() + 86400000).toISOString(),
      status: 'DIBATALKAN' // ALREADY CANCELLED
  }).select().single();

  // Add 12 submissions to this cancelled campaign
  const burnerSubs = [];
  for (let i = 0; i < 12; i++) {
    burnerSubs.push({ campaign_id: burnedCamp.campaign_id, creator_id: '8cd4af7c-2bce-4d0d-84ab-59bf68dfccda', content_url: `https://yt.com/burn${i}${Date.now()}`, status: 'PENDING' });
  }
  // Note: creator_id above is a placeholder, in real DB it must be valid. Let's use Reuse Creator 1.
  const { data: existingCreator } = await supabase.from('creators').select('id').limit(1).single();
  burnerSubs.forEach(s => s.creator_id = existingCreator.id);
  await supabase.from('submissions').insert(burnerSubs);
  console.log('Added Brand Burn scenario (Cancelled campaign with 12 subs).');

  // --- 4. GHOST REVENUE SCENARIO ---
  const { data: userG } = await supabase.from('users').insert({ email: `ghost_${Date.now()}@earner.com`, password_hash: PASSWORD_HASH, role: 'CREATOR' }).select().single();
  const { data: creatorG } = await supabase.from('creators').insert({ user_id: userG.id, nama_lengkap: 'Ghost Account', kyc_status: 'UNVERIFIED' }).select().single();
  await supabase.from('wallets').insert({ creator_id: creatorG.id, balance: 3500000, total_earned: 3500000 });
  console.log('Added Ghost Revenue scenario (Unverified, Rp 3.5jt balance).');

  console.log('--- Seeding Complete ---');
}

seed().catch(err => console.error(err));
