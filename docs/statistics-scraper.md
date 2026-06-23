# Statistics Scraper / Updater

Catatan operasional untuk data `market_statistics`.

## Lokasi scraper

Scraper/updater yang membangun ulang tabel `market_statistics` **tidak berada di repo ini**.

Lokasinya ada di repo:

```txt
putuuwiryaa-lab/backup-
```

File utama:

```txt
evaluator/market_statistics.py
```

## Fungsi

File tersebut membaca data dari tabel:

```txt
analysis_evaluations
```

Lalu membangun ulang data ke tabel:

```txt
market_statistics
```

Fungsi utama yang dijalankan:

```py
rebuild_market_statistics()
```

## Rule aktif

Rule minimum yang dipakai scraper:

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

## Hubungan dengan repo ini

Repo `analisa-angka.next` hanya membaca data dari `market_statistics` melalui:

```txt
/api/statistics
/api/invest
```

Jika data `12/15` tidak muncul di aplikasi, cek dan jalankan ulang scraper di repo `backup-`.

## Catatan Invest

Invest boleh membaca rekomendasi mulai `12/15`.

Namun bagian **Rekomendasi Sempurna** tetap harus `15/15` dan tidak boleh memakai pembulatan dari nilai di bawah 15.
