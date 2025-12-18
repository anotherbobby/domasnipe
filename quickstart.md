# Quick Start Guide 🚀

## Setup (5 menit)

```bash
# 1. Install dependencies
npm install

# 2. Setup wallet
cp .env.example .env
nano .env
# Isi PRIVATE_KEY Anda

# 3. Verify
npm start
# Bot akan create schedule.json template
```

## Add Schedule (Cara Mudah)

### Option 1: Interactive Menu (Recommended)
```bash
npm run schedule
```

Menu akan muncul:
```
1. Add new schedule
2. List schedules
3. Edit schedule
...
```

### Option 2: Quick Add (Command Line)
```bash
node schedule-helper.js quick "brag.com" "0xa100...C408" "2024-12-19 10:00" "100"
```

### Option 3: Manual Edit
```bash
nano schedule.json
```

Tambah entry:
```json
{
  "enabled": true,
  "domain": "brag.com",
  "tokenAddress": "0xa1000000006E7B861b62233823062DA63c75C408",
  "launchTime": "2024-12-19T10:00:00Z",
  "usdcAmount": "100",
  "slippage": 5,
  "gasMultiplier": 1.5,
  "maxGasPrice": "200",
  "retryAttempts": 3,
  "retryDelayMs": 1000,
  "notes": "Main target"
}
```

## Run Bot

```bash
# Show schedule
npm run show

# Test snipe immediately (untuk testing)
npm run test

# Run bot (will auto-snipe at scheduled time)
npm start
```

## Typical Workflow

```bash
# 1. Morning: Check announcements
# Domain "premium.com" akan launch jam 15:00 UTC

# 2. Add to schedule
npm run schedule
# Pilih option 1, isi data

# 3. Verify schedule
npm run list

# 4. Test dengan amount kecil (optional)
# Edit schedule: "usdcAmount": "1"
npm run test

# 5. Run for real
# Edit schedule: "usdcAmount": "100"
npm start

# 6. Bot akan tunggu sampai jam 15:00 lalu auto-snipe!
```

## Example Schedule

```json
[
  {
    "enabled": true,
    "domain": "brag.com",
    "tokenAddress": "0xa1000000006E7B861b62233823062DA63c75C408",
    "launchTime": "2024-12-19T03:00:00Z",
    "usdcAmount": "100",
    "slippage": 5,
    "gasMultiplier": 1.5,
    "maxGasPrice": "200",
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "notes": "Brag.com - 10AM WIB = 3AM UTC"
  }
]
```

## Time Conversion

| Your Time | UTC |
|-----------|-----|
| 10:00 WIB (UTC+7) | 03:00 UTC |
| 15:00 EST (UTC-5) | 20:00 UTC |
| 09:00 PST (UTC-8) | 17:00 UTC |

Use: https://www.worldtimebuddy.com/

## Common Commands

```bash
npm start              # Run bot
npm run show           # Show schedule only
npm run test           # Test snipe index 1
npm run schedule       # Interactive menu
npm run list           # List schedules

node sniper.js test 2  # Test snipe index 2
```

## Troubleshooting

### Bot exits immediately
- Check schedule.json exists
- Check at least 1 enabled schedule
- Check launch time is in future

### Transaction failed
- Increase maxGasPrice
- Increase retryAttempts
- Check USDC balance

### Wrong time
- Always use UTC in schedule.json
- Use time converter

## Pro Tips

1. **Run 5 min early**: Start bot 5-10 minutes before launch
2. **Use screen/tmux**: Keep bot running even if SSH disconnects
3. **Multiple schedules**: Add multiple targets, bot handles all
4. **Test first**: Use test mode with small amount
5. **Monitor**: Watch terminal when launch time comes

## Files

```
project/
├── sniper.js              # Main bot
├── schedule-helper.js     # Schedule manager
├── schedule.json          # Your schedules
├── .env                   # Private key
├── package.json          
├── README.md             # Full docs
└── QUICKSTART.md         # This file
```

## Safety Checklist ✅

Before running:
- [ ] Private key set in .env
- [ ] Enough USDC balance
- [ ] Enough native token for gas
- [ ] Time in UTC
- [ ] Token address correct
- [ ] Test mode works
- [ ] Bot running before launch time

## Need Help?

1. Read full README.md
2. Check logs - bot is very verbose
3. Test with small amount first

---

**Ready to snipe? Let's go! 🎯**