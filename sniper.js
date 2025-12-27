// Doma Token Sniper Bot - Schedule Based
// Install dependencies: npm install ethers dotenv

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://doma.drpc.org';
const USDC_ADDRESS = '0x31EEf89D5215C305304a2fA5376a1f1b6C5dc477';

const PRIVATE_KEY = process.env.PRIVKEY1;
const SCHEDULE_FILE = process.env.SCHEDULE_FILE || './schedule.json';

// ABI
const LAUNCHPAD_ABI = [
  'function buy(uint256 quoteAmount, uint256 minTokenAmount) external payable',
  'function getPrice(address token) external view returns (uint256)',
  'function getAvailableAmount(address token) external view returns (uint256)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)'
];

class DomaScheduledSniper {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.wallet);

    this.schedule = [];
    this.timers = [];
    this.isRunning = false;
  }

  async initialize() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   DOMA SCHEDULED SNIPER BOT v2.0         ║');
    console.log('╚═══════════════════════════════════════════╝\n');
    
    console.log('📍 Wallet:', this.wallet.address);
    
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log('💰 Native Balance:', ethers.formatEther(balance));
    
    const usdcBalance = await this.usdc.balanceOf(this.wallet.address);
    console.log('💵 USDC Balance:', ethers.formatUnits(usdcBalance, 6));

    await this.loadSchedule();
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
    } else {
      console.log('✅ USDC Already Approved');
    }
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
        "domain": "brag.com",
        "tokenAddress": "0xa1000000006E7B861b62233823062DA63c75C408",
        "launchpadAddress": "0x5089863E97196773038f98459262D866f2281f58",
        "launchTime": "2025-12-24T10:00:00.000Z",
        "usdcAmount": "100",
        "slippage": 5,
        "gasMultiplier": 1.5,
        "maxGasPrice": "200",
        "retryAttempts": 3,
        "retryDelayMs": 1000,
        "notes": "Brag.com domain token launch"
      },
      {
        "enabled": false,
        "domain": "example.xyz",
        "tokenAddress": "0x0000000000000000000000000000000000000000",
        "launchpadAddress": "0x27E022E96287F93ed69B12e10BaCd362a821Fa1f",
        "launchTime": "2025-12-20T15:30:00.000Z",
        "usdcAmount": "50",
        "slippage": 3,
        "gasMultiplier": 2.0,
        "maxGasPrice": "300",
        "retryAttempts": 5,
        "retryDelayMs": 500,
        "notes": "Example - disabled by default"
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
      console.log(`   ⚙️  Slippage: ${item.slippage}% | Gas: ${item.gasMultiplier}x`);
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
      
      const timer = setTimeout(() => {
        this.executeSnipe(config, idx + 1);
      }, delay);

      this.timers.push(timer);
      scheduledCount++;
    });

    return scheduledCount;
  }

  async executeSnipe(config, index) {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 EXECUTING SNIPE [${index}]: ${config.domain}`);
    console.log('='.repeat(60));
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`📍 Token: ${config.tokenAddress}`);
    console.log(`💰 Amount: ${config.usdcAmount} USDC`);
    console.log('');

    let attempt = 0;
    let success = false;

    while (attempt < config.retryAttempts && !success) {
      attempt++;
      
      if (attempt > 1) {
        console.log(`\n🔄 Retry attempt ${attempt}/${config.retryAttempts}...`);
        await this.sleep(config.retryDelayMs);
      }

      try {
        await this.snipeBuy(config);
        success = true;
        console.log('\n✅ SNIPE SUCCESSFUL!\n');
        
        // Play sound (opsional - butuh terminal yang support)
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

  async snipeBuy(config) {
    const tokenAddress = config.tokenAddress;
    const launchpadAddress = config.launchpadAddress;

    // Create launchpad contract
    const launchpad = new ethers.Contract(launchpadAddress, LAUNCHPAD_ABI, this.wallet);

    // Ensure approval
    await this.ensureApproval(launchpadAddress);

    // 1. Get token info
    console.log('📊 Fetching token info...');
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    try {
      const [name, symbol] = await Promise.all([
        token.name(),
        token.symbol()
      ]);
      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
    } catch (e) {
      console.log('   ⚠️  Could not fetch token metadata');
    }

    // 2. Get current price
    console.log('\n💵 Checking price...');
    let currentPrice = 0n;
    try {
      currentPrice = await launchpad.getPrice(tokenAddress);
      console.log(`   Price: ${ethers.formatUnits(currentPrice, 6)} USDC per token`);
    } catch (e) {
      console.log('   ⚠️  Could not fetch price (might not be available yet)');
    }

    // 3. Calculate amounts
    const usdcAmount = ethers.parseUnits(config.usdcAmount, 6);

    // Calculate minTokenAmount dengan slippage
    let minTokenAmount = 0n;
    if (currentPrice > 0n) {
      const expectedTokens = (usdcAmount * ethers.parseUnits("1", 18)) / currentPrice;
      minTokenAmount = (expectedTokens * BigInt(100 - config.slippage)) / 100n;
      console.log(`   Expected tokens: ${ethers.formatUnits(expectedTokens, 18)}`);
      console.log(`   Min tokens (${config.slippage}% slippage): ${ethers.formatUnits(minTokenAmount, 18)}`);
    } else {
      console.log('   Using 0 for minTokenAmount (no slippage protection)');
    }

    // 4. Estimate gas
    console.log('\n⛽ Estimating gas...');
    let gasEstimate;
    try {
      gasEstimate = await launchpad.buy.estimateGas(usdcAmount, minTokenAmount);
      console.log(`   Estimate: ${gasEstimate.toString()}`);
    } catch (error) {
      console.log('   ⚠️  Estimation failed, using default: 300000');
      gasEstimate = 300000n;
    }

    // Apply gas multiplier
    const gasLimit = (gasEstimate * BigInt(Math.floor(config.gasMultiplier * 100))) / 100n;
    console.log(`   Gas limit (${config.gasMultiplier}x): ${gasLimit.toString()}`);

    // 5. Prepare transaction
    const maxGasPrice = ethers.parseUnits(config.maxGasPrice, 'gwei');
    const maxPriorityFee = ethers.parseUnits('0.1', 'gwei'); // Fixed priority

    console.log(`   Max gas price: ${config.maxGasPrice} gwei`);
    console.log(`   Priority fee: 0.1 gwei`);

    // 6. Execute transaction
    console.log('\n📤 Sending transaction...');

    // Get current nonce to avoid nonce conflicts
    const nonce = await this.provider.getTransactionCount(this.wallet.address, 'latest');
    console.log(`   Using nonce: ${nonce}`);

    const tx = await launchpad.buy(
      usdcAmount,
      minTokenAmount,
      {
        gasLimit: gasLimit,
        maxFeePerGas: maxGasPrice,
        maxPriorityFeePerGas: maxPriorityFee,
        nonce: nonce
      }
    );

    console.log(`   TX Hash: ${tx.hash}`);
    console.log(`   🔗 https://explorer.doma.xyz/tx/${tx.hash}`);

    // 7. Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    console.log('   ✅ Confirmed!');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

    // 8. Check balance
    console.log('\n💰 Checking token balance...');
    const balance = await token.balanceOf(this.wallet.address);
    console.log(`   Balance: ${ethers.formatUnits(balance, 18)} tokens`);

    // 9. Calculate stats
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
    console.log('\n✅ Bot is running!');
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
    console.log(`\n🧪 TEST MODE: Executing snipe for ${config.domain}\n`);
    
    await this.executeSnipe(config, index);
  }
}

// Main
async function main() {
  const sniper = new DomaScheduledSniper();

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

module.exports = DomaScheduledSniper;
