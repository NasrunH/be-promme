-- Migration untuk menambahkan field profil yang lebih lengkap untuk Brand
-- Jalankan di Supabase SQL Editor
-- Versi 2 - Fixed untuk menangani casting error

-- Update tabel brands dengan field tambahan
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS alamat text,
ADD COLUMN IF NOT EXISTS kota text,
ADD COLUMN IF NOT EXISTS provinsi text,
ADD COLUMN IF NOT EXISTS kode_pos text,
ADD COLUMN IF NOT EXISTS industri text,
ADD COLUMN IF NOT EXISTS ukuran_perusahaan text,
ADD COLUMN IF NOT EXISTS deskripsi text,
ADD COLUMN IF NOT EXISTS tahun_berdiri integer;

-- Update tabel creators dengan field tambahan
ALTER TABLE public.creators
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS tanggal_lahir date,
ADD COLUMN IF NOT EXISTS jenis_kelamin text,
ADD COLUMN IF NOT EXISTS alamat text,
ADD COLUMN IF NOT EXISTS kota text,
ADD COLUMN IF NOT EXISTS provinsi text,
ADD COLUMN IF NOT EXISTS kode_pos text,
ADD COLUMN IF NOT EXISTS negara text DEFAULT 'Indonesia',
ADD COLUMN IF NOT EXISTS bahasa text[] DEFAULT ARRAY['Indonesia'],
ADD COLUMN IF NOT EXISTS kategori_niche text[],
ADD COLUMN IF NOT EXISTS pengikut_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_rate decimal(5,2);

-- Update tabel users untuk menambahkan field profil dasar
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

-- Buat enum untuk jenis kelamin
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'jenis_kelamin_enum') THEN
        CREATE TYPE jenis_kelamin_enum AS ENUM ('LAKI-LAKI', 'PEREMPUAN', 'LAINNYA');
    END IF;
END $$;

-- Update kolom jenis_kelamin untuk menggunakan enum
-- Hapus default value terlebih dahulu
ALTER TABLE public.creators ALTER COLUMN jenis_kelamin DROP DEFAULT;
-- Ubah tipe kolom
ALTER TABLE public.creators ALTER COLUMN jenis_kelamin TYPE jenis_kelamin_enum USING jenis_kelamin::text::jenis_kelamin_enum;

-- Buat enum untuk ukuran perusahaan
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ukuran_perusahaan_enum') THEN
        CREATE TYPE ukuran_perusahaan_enum AS ENUM ('STARTUP', 'UMKM', 'SME', 'KORPORASI', 'MULTINASIONAL');
    END IF;
END $$;

-- Update kolom ukuran_perusahaan untuk menggunakan enum
-- Hapus default value terlebih dahulu
ALTER TABLE public.brands ALTER COLUMN ukuran_perusahaan DROP DEFAULT;
-- Ubah tipe kolom
ALTER TABLE public.brands ALTER COLUMN ukuran_perusahaan TYPE ukuran_perusahaan_enum USING ukuran_perusahaan::text::ukuran_perusahaan_enum;

-- Buat enum untuk industri
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'industri_enum') THEN
        CREATE TYPE industri_enum AS ENUM (
            'TEKNOLOGI', 'FASHION', 'FOOD_BEVERAGE', 'KECANTIKAN', 'KESEHATAN', 
            'OTOMOTIF', 'PROPERTI', 'FINANSIAL', 'EDUKASI', 'HIBURAN', 
            'TRAVEL', 'SPORTS', 'LAINNYA'
        );
    END IF;
END $$;

-- Update kolom industri untuk menggunakan enum
-- Hapus default value terlebih dahulu
ALTER TABLE public.brands ALTER COLUMN industri DROP DEFAULT;
-- Ubah tipe kolom
ALTER TABLE public.brands ALTER COLUMN industri TYPE industri_enum USING industri::text::industri_enum;

-- Buat enum untuk kategori niche creator
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kategori_niche_enum') THEN
        CREATE TYPE kategori_niche_enum AS ENUM (
            'LIFESTYLE', 'BEAUTY', 'FASHION', 'FOOD', 'TRAVEL', 'TECH', 
            'GAMING', 'EDUCATION', 'HEALTH_FITNESS', 'COMEDY', 'MUSIC', 
            'SPORTS', 'PARENTING', 'BUSINESS', 'ART_DESIGN', 'DIY_CRAFTS', 'LAINNYA'
        );
    END IF;
END $$;

-- Update kolom kategori_niche untuk menggunakan enum array
-- Hapus default value terlebih dahulu
ALTER TABLE public.creators ALTER COLUMN kategori_niche DROP DEFAULT;
-- Ubah tipe kolom
ALTER TABLE public.creators ALTER COLUMN kategori_niche TYPE kategori_niche_enum[] USING kategori_niche::text[]::kategori_niche_enum[];

-- Buat enum untuk bahasa
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bahasa_enum') THEN
        CREATE TYPE bahasa_enum AS ENUM ('Indonesia', 'English', 'Mandarin', 'Japanese', 'Korean', 'Lainnya');
    END IF;
END $$;

-- Update kolom bahasa untuk menggunakan enum array
-- Hapus default value terlebih dahulu
ALTER TABLE public.creators ALTER COLUMN bahasa DROP DEFAULT;
-- Ubah tipe kolom
ALTER TABLE public.creators ALTER COLUMN bahasa TYPE bahasa_enum[] USING bahasa::text[]::bahasa_enum[];
-- Set default value baru
ALTER TABLE public.creators ALTER COLUMN bahasa SET DEFAULT ARRAY['Indonesia'];

-- Buat trigger untuk update profile_completed
CREATE OR REPLACE FUNCTION update_profile_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- Untuk Brand
    IF TG_TABLE_NAME = 'brands' THEN
        UPDATE public.users
        SET profile_completed = (
            NEW.nama_perusahaan IS NOT NULL AND
            NEW.pic_name IS NOT NULL AND
            NEW.phone_number IS NOT NULL
        )
        WHERE id = NEW.user_id;
    -- Untuk Creator
    ELSIF TG_TABLE_NAME = 'creators' THEN
        UPDATE public.users
        SET profile_completed = (
            NEW.nama_lengkap IS NOT NULL AND
            NEW.bio IS NOT NULL
        )
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Buat trigger untuk brands
DROP TRIGGER IF EXISTS trigger_update_brand_profile_completed ON public.brands;
CREATE TRIGGER trigger_update_brand_profile_completed
AFTER INSERT OR UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION update_profile_completed();

-- Buat trigger untuk creators
DROP TRIGGER IF EXISTS trigger_update_creator_profile_completed ON public.creators;
CREATE TRIGGER trigger_update_creator_profile_completed
AFTER INSERT OR UPDATE ON public.creators
FOR EACH ROW
EXECUTE FUNCTION update_profile_completed();

-- Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN public.brands.website IS 'Website resmi perusahaan';
COMMENT ON COLUMN public.brands.alamat IS 'Alamat lengkap perusahaan';
COMMENT ON COLUMN public.brands.kota IS 'Kota domisili perusahaan';
COMMENT ON COLUMN public.brands.provinsi IS 'Provinsi domisili perusahaan';
COMMENT ON COLUMN public.brands.kode_pos IS 'Kode pos perusahaan';
COMMENT ON COLUMN public.brands.industri IS 'Industri/jenis usaha perusahaan';
COMMENT ON COLUMN public.brands.ukuran_perusahaan IS 'Ukuran perusahaan (STARTUP, UMKM, SME, KORPORASI, MULTINASIONAL)';
COMMENT ON COLUMN public.brands.deskripsi IS 'Deskripsi singkat perusahaan';
COMMENT ON COLUMN public.brands.tahun_berdiri IS 'Tahun berdirinya perusahaan';

COMMENT ON COLUMN public.creators.bio IS 'Bio singkat creator';
COMMENT ON COLUMN public.creators.tanggal_lahir IS 'Tanggal lahir creator';
COMMENT ON COLUMN public.creators.jenis_kelamin IS 'Jenis kelamin (LAKI-LAKI, PEREMPUAN, LAINNYA)';
COMMENT ON COLUMN public.creators.alamat IS 'Alamat lengkap creator';
COMMENT ON COLUMN public.creators.kota IS 'Kota domisili creator';
COMMENT ON COLUMN public.creators.provinsi IS 'Provinsi domisili creator';
COMMENT ON COLUMN public.creators.kode_pos IS 'Kode pos creator';
COMMENT ON COLUMN public.creators.negara IS 'Negara domisili creator';
COMMENT ON COLUMN public.creators.bahasa IS 'Bahasa yang dikuasai (array)';
COMMENT ON COLUMN public.creators.kategori_niche IS 'Kategori/konten niche creator (array)';
COMMENT ON COLUMN public.creators.pengikut_total IS 'Total pengikut dari semua platform';
COMMENT ON COLUMN public.creators.engagement_rate IS 'Rata-rata engagement rate dalam persen';

COMMENT ON COLUMN public.users.phone_number IS 'Nomor telepon/WA user';
COMMENT ON COLUMN public.users.profile_completed IS 'Status kelengkapan profil';