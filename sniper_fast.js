// Doma Token Sniper Bot - Fast Version
// Install dependencies: npm install ethers dotenv

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://doma.drpc.org';
const USDC_ADDRESS = '0x31EEf89D5215C305304a2fA5376a1f1b6C5dc477';

const PRIVATE_KEY = process.env.PRIVKEY3;
const SCHEDULE_FILE = process.env.SCHEDULE_FILE || './schedule.json';

// ABI
const LAUNCHPAD_ABI = [
  'function buy(uint256 quoteAmount, uint256 minTokenAmount) external returns (uint256, uint256)',
  'function sell(uint256 tokenAmount, uint256 minQuoteAmount) external returns (uint256, uint256)',
  'function sellOnFail(uint256 tokenAmount) external returns (uint256)',
  'function getAvailableTokensToBuy() external view returns (uint256)',
  'function launchStatus() external view returns (uint8)',
  'function tokensSold() external view returns (uint256)',
  'function quoteRaised() external view returns (uint256)',
  'function tradeLocked() external view returns (bool)',
  'function migrated() external view returns (bool)',
  'function launchTokensSupply() external view returns (uint256)',
  'function domainOwnerProceeds() external view returns (uint256)',
  'function migratedAt() external view returns (uint256)',
  'function migrationPool() external view returns (address)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)'
];

class DomaFastSniper {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.wallet);

    this.schedule = [];
    this.timers = [];
    this.isRunning = false;
    this.approvedLaunchpads = new Set();
  }

  async initialize() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   DOMA FAST SNIPE BOT v1.0               ║');
    console.log('╚═══════════════════════════════════════════╝\n');
    
    console.log('📍 Wallet:', this.wallet.address);
    
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log('💰 Native Balance:', ethers.formatEther(balance));
    
    const usdcBalance = await this.usdc.balanceOf(this.wallet.address);
    console.log('💵 USDC Balance:', ethers.formatUnits(usdcBalance, 6));

    await this.loadSchedule();
    
    // Approve all launchpads at startup
    await this.approveAllLaunchpads();
  }

  async ensureApproval(launchpadAddress) {
    const amount = ethers.parseUnits("10000000", 6); // 10M USDC
    const allowance = await this.usdc.allowance(this.wallet.address, launchpadAddress);

    if (allowance < amount) {
      console.log(`\n⏳ Approving USDC for Launchpad ${launchpadAddress}...`);
      const tx = await this.usdc.approve(launchpadAddress, ethers.MaxUint256, {
        gasLimit: 100000
      });
      const receipt = await tx.wait();
      console.log('✅ USDC Approved! TX:', receipt.hash);
      this.approvedLaunchpads.add(launchpadAddress);
    } else {
      console.log('✅ USDC Already Approved');
    }
  }

  async approveAllLaunchpads() {
    console.log('\n🚀 APPROVING ALL LAUNCHPADS AT STARTUP...\n');
    
    const uniqueLaunchpads = [...new Set(this.schedule.map(s => s.launchpadAddress))];
    
    for (const launchpadAddress of uniqueLaunchpads) {
      try {
        const allowance = await this.usdc.allowance(this.wallet.address, launchpadAddress);
        const amount = ethers.parseUnits("10000000", 6); // 10M USDC
        
        if (allowance >= amount) {
          console.log(`✅ Already approved: ${launchpadAddress}`);
          this.approvedLaunchpads.add(launchpadAddress);
        } else {
          console.log(`⏳ Approving USDC for Launchpad ${launchpadAddress}...`);
          await this.ensureApproval(launchpadAddress);
        }
      } catch (error) {
        console.error(`❌ Failed to check/approve ${launchpadAddress}:`, error.message);
      }
    }
    
    console.log(`\n✅ Launchpad approval check complete! Total: ${uniqueLaunchpads.length}\n`);
  }

  loadSchedule() {
    if (!fs.existsSync(SCHEDULE_FILE)) {
      console.log('\n⚠️  Schedule file not found, creating template...');
      this.createScheduleTemplate();
      console.log(`✅ Created: ${SCHEDULE_FILE}`);
      console.log('📝 Please edit the file and restart bot\n');
      process.exit(0);
    }

    const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    this.schedule = JSON.parse(data);
    
    console.log(`\n📋 Loaded ${this.schedule.length} scheduled launch(es)\n`);
    this.displaySchedule();
  }

  createScheduleTemplate() {
    const template = [
      {
        "enabled": true,
        "domain": "OWNANDTRADE.com",
        "tokenAddress": "0xfC569C4699337a6757Db74984cBB8819aF3569eB",
        "launchpadAddress": "0x6E8a18eA01A903C15AbdC42cff4B5CC0Bcd4C5BD",
        "launchTime": "2026-01-01T00:00:00.000Z",
        "usdcAmount": "5",
        "slippage": 0,
        "gasMultiplier": 1.5,
        "maxGasPrice": "0.3",
        "retryAttempts": 3,
        "retryDelayMs": 1000,
        "notes": "oke"
      }
    ];

    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(template, null, 2));
  }

  displaySchedule() {
    const now = new Date();
    
    this.schedule.forEach((item, idx) => {
      const launchDate = new Date(item.launchTime);
      const timeUntil = launchDate - now;
      const status = item.enabled ? '🟢' : '🔴';
      
      console.log(`${status} [${idx + 1}] ${item.domain}`);
      console.log(`   Token: ${item.tokenAddress}`);
      console.log(`   Launchpad: ${item.launchpadAddress}`);
      console.log(`   Launch: ${launchDate.toLocaleString()}`);
      
      if (item.enabled) {
        if (timeUntil > 0) {
          const hours = Math.floor(timeUntil / (1000 * 60 * 60));
          const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
          console.log(`   ⏰ Time until: ${hours}h ${minutes}m ${seconds}s`);
        } else {
          console.log(`   ⚠️  ALREADY PASSED!`);
        }
      }
      
      console.log(`   💰 Amount: ${item.usdcAmount} USDC`);
      console.log(`   ⚙️  Gas: ${item.gasMultiplier}x`);
      if (item.notes) {
        console.log(`   📝 ${item.notes}`);
      }
      console.log('');
    });
  }

  scheduleSnipes() {
    const now = new Date();
    let scheduledCount = 0;

    this.schedule.forEach((config, idx) => {
      if (!config.enabled) {
        console.log(`⏭️  Skipping [${idx + 1}] ${config.domain} (disabled)`);
        return;
      }

      const launchTime = new Date(config.launchTime);
      const delay = launchTime - now;

      if (delay <= 0) {
        console.log(`⚠️  [${idx + 1}] ${config.domain} launch time already passed!`);
        return;
      }

      console.log(`⏰ Scheduled [${idx + 1}] ${config.domain} in ${Math.round(delay / 1000)}s`);
      
      // Schedule snipe (approval already done at startup)
      const snipeTimer = setTimeout(() => {
        this.executeSnipe(config, idx + 1);
      }, delay);

      this.timers.push(snipeTimer);
      scheduledCount++;
    });

    return scheduledCount;
  }

  async executeSnipe(config, index) {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 EXECUTING FAST SNIPE [${index}]: ${config.domain}`);
    console.log('='.repeat(60));
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`📍 Token: ${config.tokenAddress}`);
    console.log(`💰 Amount: ${config.usdcAmount} USDC`);
    console.log('');

    // Check approval status before sniping
    if (!this.approvedLaunchpads.has(config.launchpadAddress)) {
      console.log(`⚠️  Launchpad not approved, approving now...`);
      try {
        await this.ensureApproval(config.launchpadAddress);
      } catch (error) {
        console.error(`❌ Failed to approve launchpad:`, error.message);
        console.log('\n💀 Snipe failed due to approval error!\n');
        console.log('='.repeat(60) + '\n');
        return;
      }
    } else {
      console.log(`✅ Launchpad already approved`);
    }

    let attempt = 0;
    let success = false;

    while (attempt < config.retryAttempts && !success) {
      attempt++;

      if (attempt > 1) {
        console.log(`\n🔄 Retry attempt ${attempt}/${config.retryAttempts}...`);
        await this.sleep(config.retryDelayMs);
      }

      try {
        await this.fastSnipeBuy(config);
        success = true;
        console.log('\n✅ SNIPE SUCCESSFUL!\n');

        // Play sound
        process.stdout.write('\x07');

      } catch (error) {
        console.error(`\n❌ Attempt ${attempt} failed:`, error.message);

        if (attempt >= config.retryAttempts) {
          console.log('\n💀 All retry attempts exhausted!\n');
        }
      }
    }

    console.log('='.repeat(60) + '\n');
  }

  async fastSnipeBuy(config) {
    const tokenAddress = config.tokenAddress;
    const launchpadAddress = config.launchpadAddress;

    // Create launchpad contract
    const launchpad = new ethers.Contract(launchpadAddress, LAUNCHPAD_ABI, this.wallet);

    // 1. Calculate amounts - use 1:1000 ratio (1 USDC = 1000 tokens)
    const usdcAmount = ethers.parseUnits(config.usdcAmount, 6);
    const minTokenAmount = 0n; // Remove slippage protection
    
    console.log(`   USDC Amount: ${ethers.formatUnits(usdcAmount, 6)}`);
    console.log(`   Min Token Amount: ${minTokenAmount} (no slippage protection)`);

    // 2. Execute transaction with gas price from schedule.json
    console.log('\n🚀 Sending transaction with gas from schedule...');
    
    const tx = await launchpad.buy(
      usdcAmount,
      minTokenAmount,
      {
        gasLimit: 300000,
        gasPrice: ethers.parseUnits(config.maxGasPrice || "0.3", "gwei")
      }
    );
    
    console.log(`   TX Hash: ${tx.hash}`);
    console.log(`   🔗 https://explorer.doma.xyz/tx/${tx.hash}`);
    
    // 3. Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    console.log('   ✅ Confirmed!');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

    // 4. Check balance
    console.log('\n💰 Checking token balance...');
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance = await token.balanceOf(this.wallet.address);
    console.log(`   Balance: ${ethers.formatUnits(balance, 18)} tokens`);

    // 5. Calculate stats
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    console.log(`   Gas cost: ${ethers.formatEther(gasCost)} ETH`);

    return receipt;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Bot already running');
      return;
    }

    await this.initialize();

    const scheduledCount = this.scheduleSnipes();

    if (scheduledCount === 0) {
      console.log('\n⚠️  No valid schedules found!');
      console.log('📝 Please edit schedule.json and restart\n');
      process.exit(0);
    }

    this.isRunning = true;
    console.log('\n✅ Fast Bot is running!');
    console.log(`📅 ${scheduledCount} snipe(s) scheduled`);
    console.log('⌨️  Press Ctrl+C to stop\n');
  }

  stop() {
    console.log('\n🛑 Stopping bot...');
    
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
    
    this.isRunning = false;
    console.log('✅ All timers cleared\n');
  }

  // Utility: Test snipe immediately
  async testSnipe(index) {
    if (index < 1 || index > this.schedule.length) {
      console.log(`❌ Invalid index. Use 1-${this.schedule.length}`);
      return;
    }

    const config = this.schedule[index - 1];
    console.log(`\n🧪 TEST MODE: Executing fast snipe for ${config.domain}\n`);
    
    await this.executeSnipe(config, index);
  }
}

// Main
async function main() {
  const sniper = new DomaFastSniper();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    sniper.stop();
    process.exit(0);
  });

  // Check for test mode
  const args = process.argv.slice(2);
  
  if (args[0] === 'test' && args[1]) {
    await sniper.initialize();
    await sniper.testSnipe(parseInt(args[1]));
    process.exit(0);
  }
  
  if (args[0] === 'show') {
    await sniper.initialize();
    process.exit(0);
  }

  await sniper.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n💀 Fatal Error:', error);
    process.exit(1);
  });
}

module.exports = DomaFastSniper;