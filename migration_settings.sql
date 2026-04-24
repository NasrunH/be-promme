-- SQL untuk membuat tabel pengaturan sistem
-- Jalankan ini di SQL Editor Supabase Anda

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inisialisasi frekuensi tracking default (1 menit)
INSERT INTO system_settings (key, value) 
VALUES ('tracker_frequency', '1')
ON CONFLICT (key) DO NOTHING;
