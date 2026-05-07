-- ══════════════════════════════════════════════════
-- PasienQuC v.0.4.0 — Supabase SQL Schema
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

-- Index untuk query cepat
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

-- 3. Row Level Security (RLS) — akses publik untuk anon key
ALTER TABLE qc_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan baca untuk semua (anon)
CREATE POLICY "allow_select" ON qc_sessions
  FOR SELECT USING (true);

-- Policy: izinkan insert untuk semua (anon)
CREATE POLICY "allow_insert" ON qc_sessions
  FOR INSERT WITH CHECK (true);

-- Policy: izinkan delete untuk semua (anon)
CREATE POLICY "allow_delete" ON qc_sessions
  FOR DELETE USING (true);

-- ══════════════════════════════════════════════════
-- SELESAI. Klik "Run" di SQL Editor Supabase.
-- ══════════════════════════════════════════════════
