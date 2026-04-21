-- ============================================================
-- MIGRATION: Tambahkan tabel campaign_participants dan kolom 
-- min_konten_diterima di tabel campaigns
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom min_konten_diterima ke tabel campaigns (jika belum ada)
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS min_konten_diterima INTEGER NOT NULL DEFAULT 0;

-- 2. Buat tabel campaign_participants (tabel join antara creator dan campaign)
CREATE TABLE IF NOT EXISTS campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: satu creator hanya bisa join satu campaign sekali
  UNIQUE(campaign_id, creator_id)
);

-- 3. Index untuk mempercepat query lookup
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_creator ON campaign_participants(creator_id);

-- 4. Enable Row Level Security (opsional tapi direkomendasikan)
ALTER TABLE campaign_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Backend service role bisa baca/tulis semua
-- (Karena kita pakai anon key dari server-side, RLS tidak menghalangi)
