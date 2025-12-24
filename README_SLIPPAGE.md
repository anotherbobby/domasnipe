# Dynamic Slippage Implementation

## Perubahan pada sniper_fast.js

File `sniper_fast.js` telah dimodifikasi untuk menggunakan RPC call dalam menentukan slippage secara dinamis, bukan menggunakan nilai tetap 1:1 USDC.

### Masalah Sebelumnya
- Menggunakan asumsi 1:1 ratio untuk semua token
- Tidak cocok untuk token dengan harga sangat rendah seperti 0.00002 USDC
- Banyak kegagalan transaksi karena slippage terlalu ketat

### Solusi Baru
- **Dynamic Slippage Calculation**: Menghitung slippage berdasarkan kondisi pool aktual
- **Price Level Detection**: Secara otomatis meningkatkan slippage untuk token harga rendah
- **Trade Size Impact**: Menyesuaikan slippage berdasarkan ukuran trade relatif terhadap pool

### Contoh Perhitungan
Untuk token dengan harga 0.00002 USDC:
- 5 USDC seharusnya mendapatkan ~250,000 token
- Dengan slippage 25%, minimum yang diterima: 187,500 token
- Sistem secara otomatis menyesuaikan berdasarkan kondisi pool

### Penggunaan
```bash
# Hitung slippage untuk token harga tertentu
node slippage_helper.js 0.00002 5

# Contoh output:
# Token Price: 0.00002 USDC
# Expected Tokens: 250,000
# Recommended Slippage: 25% (max 90%)
```

### File yang Dimodifikasi
- `sniper_fast.js`: Implementasi dynamic slippage calculation
- `schedule.json`: Contoh konfigurasi untuk berbagai jenis token
- `slippage_helper.js`: Tool bantu perhitungan slippage
- `SLIPPAGE_CHANGES.md`: Dokumentasi perubahan

### Keuntungan
- Transaksi lebih berhasil untuk token harga rendah
- Perlindungan lebih baik terhadap volatilitas
- Pengaturan slippage lebih akurat dan dinamis