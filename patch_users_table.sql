-- Menambahkan kolom profile untuk Admin & Finance di tabel users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS nama_lengkap text,
ADD COLUMN IF NOT EXISTS profile_picture_url text;
