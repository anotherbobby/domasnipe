# Doma Token Sniper Bot v2

Bot untuk otomatis snipe token domain di app.doma.xyz dengan monitoring real-time.

## 🎯 Cara Kerja

Bot ini **TIDAK** monitoring event dari smart contract (karena kita belum tahu event apa yang di-emit), tapi menggunakan strategi lebih robust:

### 3 Mode Monitoring:

1. **Mempool Monitoring** (⚡ Fastest)
   - Monitor pending transactions yang menuju DomaLaunchpad
   - Detect saat ada orang lain yang mau buy token baru
   - Front-run dengan gas lebih tinggi
   - Butuh WebSocket connection

2. **Block Monitoring** (🔒 Most Reliable)
   - Scan setiap block baru untuk transaksi ke Launchpad
   - Lebih lambat tapi sangat reliable
   - Tidak butuh WebSocket

3. **Both** (🚀 Recommended)
   - Kombinasi keduanya untuk coverage maksimal
   - Mempool untuk speed, blocks untuk reliability

4. **Manual Mode**
   - Check token spesifik secara manual
   - Useful untuk testing atau buying known token

## 📦 Installation

```bash
# Install dependencies
npm install ethers dotenv

# Setup environment
cp .env.example .env
nano .env
```

## ⚙️ Configuration

Edit `.env`:

```env
# Required
PRIVATE_KEY=your_key_here

# Snipe settings
USDC_AMOUNT=10
TARGET_DOMAIN_CONTRACT=   # Kosongkan untuk snipe semua

# Monitor mode
MONITOR_MODE=both   # mempool | blocks | both | manual
```

## 🚀 Usage

### Auto Snipe Mode

```bash
# Start bot dengan mode yang dipilih di .env
node sniper.js
```

Output akan seperti:
```
🚀 Initializing Doma Sniper Bot...
📍 Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8
💰 Native Balance: 1.5
💵 USDC Balance: 1000
🎯 Target: ALL tokens
✅ USDC Already Approved
📦 Starting from block: 12345
🔧 Monitor Mode: both

👀 Bot is now active!
Press Ctrl+C to stop

🌊 Monitoring mempool...
✅ Mempool monitoring active
📦 Monitoring new blocks...

🔍 Scanning block 12346 (15 txs)
🔔 Pending TX to Launchpad: 0xabc123...

🔍 Decoded function: buy

🆕 NEW TOKEN DETECTED!
📍 Token: 0xa1000000006E7B861b62233823062DA63c75C408
💰 Buyer trying to buy: 5000
🔗 TX: https://explorer.doma.xyz/tx/0xabc...
📛 Name: Brag Domain Token
🏷️  Symbol: BRAG
⚡ Detected in mempool - front-running!

💰 SNIPING 0xa100...C408...
💵 Price: 0.001 USDC
💸 Buying with 10 USDC...
⛽ Gas estimate: 250000
📤 TX Sent: 0xdef456...
🔗 https://explorer.doma.xyz/tx/0xdef456...
⏳ Waiting for confirmation...
✅✅✅ BUY SUCCESSFUL! ✅✅✅
⛽ Gas used: 245123
🎉 Token balance: 10000
```

### Manual Check Mode

```bash
# Check token tertentu
node sniper.js 0xa1000000006E7B861b62233823062DA63c75C408
```

Output:
```
🔍 Checking token: 0xa100...C408
💵 Current Price: 0.001 USDC
📦 Available Amount: 50000
📛 Name: Brag Domain Token
🏷️  Symbol: BRAG

❓ Buy this token? (y/n): _
```

## 🎯 Strategi Snipe

### 1. Snipe Semua Token Baru
```env
TARGET_DOMAIN_CONTRACT=
MONITOR_MODE=both
```
Bot akan auto-buy setiap token baru yang launch.

### 2. Snipe Domain Spesifik
```env
TARGET_DOMAIN_CONTRACT=0xa1000000006E7B861b62233823062DA63c75C408
MONITOR_MODE=both
```
Bot hanya akan buy token ini saja.

### 3. Front-Running
```env
MONITOR_MODE=mempool
```
Detect pending tx dan front-run dengan gas tinggi.

### 4. Safe Mode
```env
MONITOR_MODE=blocks
```
Tunggu sampai transaksi confirmed di block.

## 📊 How It Works

```
1. Bot monitoring:
   ├─ Mempool (pending txs) → Detect early
   └─ New blocks → Reliable detection

2. Saat detect transaksi buy() ke Launchpad:
   ├─ Decode function call
   ├─ Extract token address
   ├─ Check if new token
   └─ Check if match target

3. Auto snipe:
   ├─ Get token info (name, symbol)
   ├─ Get current price
   ├─ Calculate amount to buy
   ├─ Execute buy() dengan high gas
   └─ Wait confirmation

4. Hasil:
   └─ Show balance & tx link
```

## 💡 Tips

### Untuk Speed:
- Gunakan `MONITOR_MODE=mempool`
- Increase gas ke 200-300 gwei jika network ramai
- Deploy bot di VPS dekat RPC server

### Untuk Reliability:
- Gunakan `MONITOR_MODE=both`
- Set USDC_AMOUNT lebih kecil untuk testing
- Pre-approve USDC sebelum launch

### Untuk Profit:
- Research domain yang akan launch
- Set TARGET_DOMAIN_CONTRACT untuk domain bagus
- Buy early, bonding curve naik = profit

## ⚠️ Known Issues & Solutions

### Issue 1: "Cannot decode transaction"
**Penyebab:** ABI tidak lengkap atau function signature berbeda

**Solusi:** Update ABI setelah dapat info dari explorer:
```javascript
const LAUNCHPAD_ABI = [
  'function buy(address token, uint256 minAmount) external',
  // Tambah function lain yang ketemu
];
```

### Issue 2: "WebSocket connection failed"
**Penyebab:** RPC tidak support WebSocket

**Solusi:** Gunakan block monitoring saja:
```env
MONITOR_MODE=blocks
```

### Issue 3: "Transaction failed"
**Penyebab:** Slippage, gas, atau bonding curve sudah sold out

**Solusi:** 
- Increase gas limit
- Decrease USDC_AMOUNT
- Check token masih available

### Issue 4: "Not detecting new tokens"
**Penyebab:** Mungkin cara launch berbeda dari yang kita assume

**Solusi:** 
1. Manual check token yang sudah launch: `node sniper.js 0xTokenAddr`
2. Cek transaction di explorer untuk lihat method call yang actual
3. Update ABI berdasarkan findings

## 🔧 Advanced: Update ABI

Jika bot tidak detect token, kemungkinan method name berbeda. Cara update:

1. Buka transaction yang sukses buy di explorer
2. Lihat "Method" yang dipanggil (contoh: `purchase`, `buyTokens`, dll)
3. Update LAUNCHPAD_ABI di code:

```javascript
const LAUNCHPAD_ABI = [
  'function purchase(address token, uint256 amount) external', // Ganti sesuai findings
  // ... tambah function lain
];
```

## 📚 References

- **Doma Docs:** https://docs.doma.xyz
- **Explorer:** https://explorer.doma.xyz
- **Launchpad Contract:** `0x535f494Cf6447068CfE54936401740Ce5FC4dCAD`
- **USDC Contract:** `0x31EEf89D5215C305304a2fA5376a1f1b6C5dc477`

## 🚨 Disclaimer

⚠️ **PENTING:**
- Bot ini untuk educational purposes
- Crypto trading sangat berisiko
- No guarantee of profit
- Bisa kehilangan seluruh investment
- Always DYOR (Do Your Own Research)
- Test dengan amount kecil dulu
- Understand smart contract sebelum invest

**Known Risks:**
- Front-running bisa gagal jika gas orang lain lebih tinggi
- Bonding curve bisa sold out sebelum tx kita masuk
- Token bisa rug pull atau scam
- Smart contract bisa ada bug atau exploit
- Network congestion bisa delay transaksi

## 📄 License

MIT License - Use at your own risk!