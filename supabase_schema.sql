-- ══════════════════════════════════════════════════
-- PasienQuC v.0.5.0 — Supabase SQL Schema (hardened)
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════

-- 1. Tabel utama: sesi QC per data point
CREATE TABLE IF NOT EXISTS qc_sessions (
  id           BIGSERIAL PRIMARY KEY,
  param        TEXT NOT NULL,           -- e.g. "Hb", "Na", "PT"
  ward         TEXT NOT NULL,           -- e.g. "IGD", "ICU", "RANAP"
  value        NUMERIC NOT NULL,        -- nilai hasil pemeriksaan
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_param_ward    ON qc_sessions(param, ward);
CREATE INDEX IF NOT EXISTS idx_qc_recorded_at   ON qc_sessions(recorded_at);
CREATE INDEX IF NOT EXISTS idx_qc_param_ward_at ON qc_sessions(param, ward, recorded_at);

-- 2. View: agregasi bulanan otomatis
CREATE OR REPLACE VIEW qc_monthly AS
SELECT
  param,
  ward,
  TO_CHAR(DATE_TRUNC('month', recorded_at), 'YYYY-MM') AS month,
  COUNT(*)                                              AS n_count,
  ROUND(AVG(value)::numeric, 3)                        AS mean_val,
  ROUND(STDDEV(value)::numeric, 3)                     AS sd_val,
  ROUND((STDDEV(value) / NULLIF(AVG(value), 0) * 100)::numeric, 2) AS cv_pct
FROM qc_sessions
GROUP BY param, ward, DATE_TRUNC('month', recorded_at)
ORDER BY param, ward, month;

-- 3. Row Level Security (RLS)
-- Aplikasi memakai anon key yang ikut ter-bundle di browser, jadi anon key
-- BUKAN rahasia. Karena itu policy harus seketat mungkin untuk apa yang benar
-- benar dibutuhkan aplikasi: hanya SELECT (baca tren) dan INSERT (simpan data).
-- DELETE publik DIHAPUS — aplikasi tidak pernah menghapus baris di Supabase
-- (tombol "Hapus" di UI hanya membuang data dari state lokal), dan DELETE
-- publik berarti siapa pun bisa mengosongkan seluruh database QC Anda.
ALTER TABLE qc_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select" ON qc_sessions;
DROP POLICY IF EXISTS "allow_insert" ON qc_sessions;
DROP POLICY IF EXISTS "allow_delete" ON qc_sessions;   -- cabut akses hapus publik

CREATE POLICY "allow_select" ON qc_sessions
  FOR SELECT USING (true);

CREATE POLICY "allow_insert" ON qc_sessions
  FOR INSERT WITH CHECK (true);

-- Sengaja TIDAK ada policy DELETE/UPDATE → anon tidak bisa menghapus/mengubah data.

-- ══════════════════════════════════════════════════
-- Langkah berikutnya (disarankan): autentikasi sungguhan.
-- Selama app hanya "login" dengan Groq key, siapa pun tetap bisa INSERT data
-- palsu. Jika sudah pakai Supabase Auth, ganti policy di atas menjadi:
--   USING (auth.uid() IS NOT NULL)  /  WITH CHECK (auth.uid() IS NOT NULL)
-- agar hanya user terautentikasi yang bisa baca & tulis.
-- ══════════════════════════════════════════════════
