-- PATCH DATA UNTUK MENDUKUNG FITUR KYC DAN 2FA
-- Tambahkan kolom di tabel users untuk support 2FA (Two Factor Authentication)
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT false;

-- Tambahkan kolom di tabel creators untuk menyimpan URL bukti KYC
ALTER TABLE creators ADD COLUMN IF NOT EXISTS ktp_image_url TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS selfie_image_url TEXT;

-- Indexing tambahan untuk performa (Optional tapi disarankan)
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
