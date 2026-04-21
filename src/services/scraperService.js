const fetch = require('node-fetch');

// Fungsi untuk mengekstrak jumlah views dari platform sosial media
const scrapeViews = async (url, platform) => {
  try {
    const p = platform ? platform.toUpperCase() : '';
    
    // YOUTUBE SCRAPING
    if (p === 'YOUTUBE' || url.includes('youtube.com') || url.includes('youtu.be')) {
      const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }});
      const html = await res.text();
      const match = html.match(/"viewCount":"(\d+)"/);
      if (match && match[1]) return parseInt(match[1], 10);
    }
    
    // TIKTOK SCRAPING
    if (p === 'TIKTOK' || url.includes('tiktok.com')) {
      const res = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' 
        }
      });
      const html = await res.text();
      const match = html.match(/"playCount":(\d+)/);
      if (match && match[1]) return parseInt(match[1], 10);
    }

    // INSTAGRAM & FALLBACK
    // Karena IG sering memblokir scraper dengan halaman login
    // kita kembalikan "null" agar sistem fallback ke simulasi realistis
    return null;

  } catch (error) {
    console.error(`Scraping error for ${url}:`, error.message);
    return null; // Fallback jika gagal
  }
};

module.exports = { scrapeViews };
