# PasienQuC v.0.2.0

**Patient-Based Real-Time Quality Control** untuk CBC Hematologi dengan fitur AI.

Dibuat oleh **dr. WIY** · April 2026

---

## Fitur

- 📊 **PBRTQC Dashboard** — Control chart: Moving Average, EWMA, Trimmed Mean, Median/AoN
- ✦ **Interpretasi AI Otomatis** — Kesimpulan klinis QC dalam bahasa Indonesia
- 💬 **Chatbot Analitik** — Tanya bebas seputar hasil QC dan PBRTQC
- 📝 **Narasi Laporan** — Laporan QC siap cetak (formal / ringkas / rekomendasi)
- 📐 **OPSpecs & Sigma Metric** — Gauge interaktif + tabel panduan
- 📤 **Export CSV & TXT**

---

## Deploy ke Vercel (Rekomendasi)

### Cara 1 — Via GitHub (termudah)

```bash
git init
git add .
git commit -m "PasienQuC v0.2.0"
git remote add origin https://github.com/USERNAME/pasienquc.git
git push -u origin main
```

Lalu buka vercel.com → Login GitHub → Import repo → Deploy. Selesai dalam 30 detik.

### Cara 2 — Vercel CLI

```bash
npm install && npm i -g vercel && vercel
```

### Cara 3 — Drag Drop

```bash
npm install && npm run build
# Upload folder dist ke vercel.com/new
```

---

## Jalankan Lokal

```bash
npm install
npm run dev
# Buka http://localhost:5173
```

---

## Cara Pakai

1. Masukkan Groq API Key — daftar gratis di console.groq.com/keys
2. Dashboard → load data demo atau upload CSV
3. Tab AI → interpretasi, chatbot, narasi laporan
4. Tab OPSpecs → sigma metric interaktif
5. Tab Report → export hasil

---

## Format CSV

```
Hb
12.5
13.2
11.8
```

Header: Hb · MCV · PLT · WBC · MCH · MCHC · RBC

---

## Tech Stack

React 18 + Vite 5 · Recharts · Groq API (LLaMA 3.3 70B)

---

*PasienQuC v.0.2.0 · dr. WIY · April 2026*
