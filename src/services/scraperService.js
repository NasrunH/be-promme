const axios = require('axios');

/**
 * Fungsi untuk mengambil jumlah views dari platform sosial media menggunakan API Resmi / RapidAPI
 * Harap isi YOUTUBE_API_KEY dan RAPIDAPI_KEY di file .env
 */
const scrapeViews = async (url, platform) => {
  const p = platform ? platform.toUpperCase() : '';
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  try {
    // 1. YOUTUBE (Menggunakan Official YouTube Data API v3)
    if (p === 'YOUTUBE' || url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('shorts/')) {
        videoId = url.split('shorts/')[1].split('?')[0];
      }

      if (videoId && YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'your_youtube_api_key_here') {
        const res = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`);
        if (res.data.items && res.data.items.length > 0) {
          return parseInt(res.data.items[0].statistics.viewCount, 10);
        }
      }
    }

    // 2. TIKTOK (Menggunakan 'TikTok Video API - No Watermark' sesuai screenshot)
    if (p === 'TIKTOK' || url.includes('tiktok.com')) {
      if (RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here') {
        const options = {
          method: 'GET',
          url: 'https://tiktok-video-api-no-watermark.p.rapidapi.com/get_video_data.php',
          params: {
            tiktok_video_id_or_url: url,
            data: 'video_details'
          },
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'tiktok-video-api-no-watermark.p.rapidapi.com'
          }
        };
        const res = await axios.request(options);

        // Berdasarkan struktur umum API ini, views ada di data.play_count
        const views = res.data?.data?.play_count;
        if (views !== undefined) return parseInt(views, 10);
      }
    }

    // 3. INSTAGRAM (Menggunakan RapidAPI - Contoh: Instagram Data)
    if (p === 'INSTAGRAM' || url.includes('instagram.com')) {
      if (RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here') {
        const options = {
          method: 'GET',
          url: 'https://instagram-data1.p.rapidapi.com/post/info', // Ganti endpoint sesuai API yang Anda pilih di RapidAPI
          params: { url: url },
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'instagram-data1.p.rapidapi.com'
          }
        };
        const res = await axios.request(options);
        // Path data mungkin berbeda tergantung API yang Anda pilih di RapidAPI
        const views = res.data?.video_view_count || res.data?.view_count;
        if (views !== undefined) return parseInt(views, 10);
      }
    }

    // Jika semua gagal atau API Key belum diisi
    return null;

  } catch (error) {
    // Log error tanpa mengekspos API Key
    console.error(`[SCRAPER] Error fetching views for ${url}:`, error.message);
    return null;
  }
};

module.exports = { scrapeViews };
