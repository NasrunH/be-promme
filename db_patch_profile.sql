-- Menambahkan kolom logo_url pada tabel brands
ALTER TABLE public.brands
ADD COLUMN logo_url text;

-- Menambahkan kolom profile_picture_url pada tabel creators
ALTER TABLE public.creators
ADD COLUMN profile_picture_url text;

-- (Opsional) Mengisi default value jika diperlukan:
-- UPDATE public.brands SET logo_url = '' WHERE logo_url IS NULL;
-- UPDATE public.creators SET profile_picture_url = '' WHERE profile_picture_url IS NULL;
