# Scraper / Evaluator

Catatan operasional untuk scraper, evaluator, dan pembentuk data pendukung aplikasi.

## Lokasi utama scraper

Seluruh scraper/evaluator operasional **tidak berada di repo ini**.

Lokasi utamanya ada di repo:

```txt
putuuwiryaa-lab/backup-
```

Repo `analisa-angka.next` adalah aplikasi web/frontend + API pembaca data. Data hasil scrape/evaluasi dibaca dari Supabase.

## File scraper di repo backup-

File scraper utama yang perlu dicek berada di repo `backup-`:

```txt
scraper_with_predictions.py
scraper_rajapaito_with_predictions.py
scraper_totogp_with_predictions.py
.github/workflows/scraper.yml
```

Workflow scraper GitHub Actions juga berada di repo `backup-`:

```txt
.github/workflows/scraper.yml
```

## File updater statistik

Updater yang membangun ulang tabel `market_statistics` juga berada di repo `backup-`:

```txt
evaluator/market_statistics.py
```

Fungsi utama yang dijalankan untuk rebuild statistik:

```py
rebuild_market_statistics()
```

## Alur data ringkas

```txt
repo backup-
→ scraper mengambil result pasaran
→ evaluator mengisi / memperbarui analysis_evaluations
→ updater statistik membangun ulang market_statistics
→ repo analisa-angka.next membaca data untuk UI
```

Repo `analisa-angka.next` membaca data melalui endpoint seperti:

```txt
/api/markets
/api/evaluations
/api/statistics
/api/invest
```

## Rule statistik aktif

Rule minimum updater statistik di `backup-`:

```txt
SAMPLE_SIZE = 15
MIN_WINS_15 = 12
MIN_WINS_LAST_5 = 3
MAX_LOSS_STREAK_ALLOWED = 2
```

Artinya data statistik yang boleh disimpan ke `market_statistics` adalah:

```txt
wins_15 >= 12
wins_last_5 >= 3
max_loss_streak <= 2
```

## Catatan Invest

Invest boleh membaca rekomendasi mulai `12/15`.

Namun bagian **Rekomendasi Sempurna** tetap harus `15/15` dan tidak boleh memakai pembulatan dari nilai di bawah 15.

## Jika data tidak muncul di aplikasi

Cek urutan ini:

```txt
1. Pastikan scraper di repo backup- sudah berjalan.
2. Pastikan evaluator sudah mengisi analysis_evaluations.
3. Jalankan rebuild_market_statistics() dari repo backup-.
4. Cek tabel market_statistics di Supabase.
5. Baru cek tampilan di repo analisa-angka.next.
```
