const supabase = require('./src/config/supabase');

async function seedSubmissions() {
    console.log('--- Seeding 100+ High-Visibility Submissions ---');

    // 1. Get valid creators and active campaigns
    const { data: creators } = await supabase.from('creators').select('id, nama_lengkap');
    const { data: campaigns } = await supabase.from('campaigns').select('campaign_id, nama_campaign').eq('status', 'AKTIF');

    if (!creators?.length || !campaigns?.length) {
        console.error('Batal: Perlu ada creator dan campaign aktif untuk seeding.');
        return;
    }

    console.log(`Using ${creators.length} creators and ${campaigns.length} active campaigns.`);

    const submissions = [];
    const statuses = ['PENDING', 'SELESAI', 'PENDING', 'PENDING']; // More PENDINGs
    const platforms = ['youtube.com', 'tiktok.com', 'instagram.com'];

    for (let i = 0; i < 100; i++) {
        const creator = creators[Math.floor(Math.random() * creators.length)];
        const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        submissions.push({
            campaign_id: campaign.campaign_id,
            creator_id: creator.id,
            content_url: `https://www.${platform}/watch?v=promo_${Math.random().toString(36).substring(7)}`,
            status: status,
            views_tervalidasi: Math.floor(Math.random() * 10000),
            submitted_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString()
        });
    }

    // Clear existing dummy submissions if any (optional, but let's just insert)
    const { error } = await supabase.from('submissions').insert(submissions);
    if (error) {
        console.error('Gagal seeding submissions:', error);
    } else {
        console.log('Successfully added 100 high-visibility submissions!');
    }

    console.log('--- Seeding Complete ---');
}

seedSubmissions();
