# Perubahan pada sniper_fast.js - Dynamic Slippage Calculation

## Ringkasan Perubahan

File `sniper_fast.js` telah dimodifikasi untuk menggunakan RPC call dalam menentukan slippage secara dinamis, bukan menggunakan nilai tetap 1:1 USDC. Perubahan ini sangat penting untuk token dengan harga sangat rendah seperti 0.00002 USDC.

## Perubahan Utama

### 1. Fungsi `calculateDynamicSlippage()` (Baris 312-392)
- **Sebelumnya**: Menggunakan asumsi 1:1 ratio untuk semua token
- **Sekarang**: Menghitung slippage berdasarkan kondisi pool yang sebenarnya

### 2. Fungsi `simulateBondingCurve()` (Baris 394-442)
- **Fitur baru**: Simulasi kurva bonding untuk memperkirakan dampak trade
- **Deteksi harga rendah**: Secara otomatis meningkatkan slippage untuk token dengan harga < 0.001 USDC
- **Perhitungan dinamis**: Menyesuaikan slippage berdasarkan rasio ukuran trade terhadap pool

### 3. Fungsi `estimateTokenAmount()` (Baris 444-454)
- **Estimasi harga**: Menghitung jumlah token yang diharapkan berdasarkan harga saat ini
- **Batasan pool**: Memastikan tidak melebihi jumlah token yang tersedia
- **Fallback untuk token baru**: Mengasumsikan 1 USDC = 50,000 token untuk token tanpa riwayat harga

## Logika Slippage Dinamis

### Untuk Token Harga Rendah (< 0.001 USDC)
- Slippage dasar: 5x dari slippage yang ditentukan
- Maksimum: 90%
- Contoh: Jika slippage diatur 10%, akan menjadi 50%

### Untuk Token Harga Sedang (< 0.01 USDC)
- Slippage dasar: 3x dari slippage yang ditentukan
- Maksimum: 70%
- Contoh: Jika slippage diatur 10%, akan menjadi 30%

### Penyesuaian Berdasarkan Ukuran Trade
- Trade > 30% dari pool: Slippage x2 (maks 95%)
- Trade > 10% dari pool: Slippage x1.5 (maks 80%)

## Contoh Penggunaan

### Token Normal (~1 USDC)
```json
{
  "slippage": 10,
  "notes": "Token with normal price"
}
```

### Token Harga Rendah (~0.00002 USDC)
```json
{
  "slippage": 25,
  "notes": "Token with very low price - use higher slippage"
}
```

### Token Micro-cap (Volatilitas Ekstrem)
```json
{
  "slippage": 35,
  "notes": "Micro-cap token with extreme volatility"
}
```

## Keuntungan

1. **Akurasi Lebih Tinggi**: Slippage disesuaikan dengan kondisi pasar aktual
2. **Perlindungan Lebih Baik**: Menghindari kegagalan transaksi untuk token harga rendah
3. **Fleksibilitas**: Bisa menyesuaikan dengan berbagai jenis token dan kondisi pool
4. **Fallback Aman**: Tetap menggunakan pendekatan konservatif jika terjadi error

## Catatan

- Sistem ini masih menggunakan pendekatan konservatif untuk memastikan keberhasilan transaksi
- Untuk token dengan harga sangat rendah, disarankan menggunakan slippage awal yang lebih tinggi (25-35%)
- Sistem secara otomatis akan menyesuaikan slippage berdasarkan kondisi pool saat eksekusi