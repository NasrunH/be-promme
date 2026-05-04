-- Patch untuk tabel creators: Menambahkan kolom profil lengkap
ALTER TABLE creators ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS jenis_kelamin VARCHAR(20);
ALTER TABLE creators ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS kota VARCHAR(100);
ALTER TABLE creators ADD COLUMN IF NOT EXISTS provinsi VARCHAR(100);
ALTER TABLE creators ADD COLUMN IF NOT EXISTS kode_pos VARCHAR(10);
ALTER TABLE creators ADD COLUMN IF NOT EXISTS negara VARCHAR(100) DEFAULT 'Indonesia';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS bahasa JSONB DEFAULT '[]';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS kategori_niche JSONB DEFAULT '[]';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS ktp_image_url TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS selfie_image_url TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS pengikut_total INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Patch untuk tabel connected_social_accounts: Menambahkan statistik
ALTER TABLE connected_social_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE connected_social_accounts ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,2) DEFAULT 0.00;

-- Update updated_at trigger (jika belum ada)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_creators_modtime') THEN
        CREATE TRIGGER update_creators_modtime BEFORE UPDATE ON creators FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;
