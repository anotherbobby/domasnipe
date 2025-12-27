// Doma Token Sniper Bot - Schedule Based
// Install dependencies: npm install ethers dotenv

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://doma.drpc.org';
const USDC_ADDRESS = '0x31EEf89D5215C305304a2fA5376a1f1b6C5dc477';

const PRIVATE_KEY = process.env.PRIVKEY2;
const SCHEDULE_FILE = process.env.SCHEDULE_FILE || './schedule.json';

// ABI
const LAUNCHPAD_ABI = [
  'function buy(uint256 quoteAmount, uint256 minTokenAmount) external payable returns (uint256, uint256)',
  'function sell(uint256 tokenAmount, uint256 minQuoteAmount) external returns (uint256, uint256)',
  'function sellOnFail(uint256 tokenAmount) external returns (uint256)',
  'function getAvailableTokensToBuy() external view returns (uint256)',
  'function launchStatus() external view returns (uint8)',
  'function tokensSold() external view returns (uint256)',
  'function quoteRaised() external view returns (uint256)',
  'function tradeLocked() external view returns (bool)',
  'function migrated() external view returns (bool)',
  'function migratedAt() external view returns (uint256)',
  'function domainOwnerProceeds() external view returns (uint256)',
  'function migrationPool() external view returns (address)',
  'function launchTokensSupply() external view returns (uint256)',
  'function launchStart() external view returns (uint256)',
  'function launchEnd() external view returns (uint256)',
  'function domainOwner() external view returns (address)',
  'function buySellFeeRecipient() external view returns (address)',
  'function vestingWallet() external view returns (address)',
  'function buyFeeRateBps() external view returns (uint256)',
  'function sellFeeRateBps() external view returns (uint256)',
  'function setBuyFeeRate(uint256 _buyFeeRate) external',
  'function setSellFeeRate(uint256 _sellFeeRate) external',
  'function withdrawDomainOwnerProceeds() external',
  'function withdrawQuoteToken(address withdrawAddress, uint256 amount) external',
  'function withdrawFractionalToken(address withdrawAddress, uint256 amount) external',
  'function setTradeLockStatus(bool locked) external',
  'function adjustLaunchEndTime(uint256 newLaunchEndTime) external',
  'function adjustLaunchStartTime(uint256 newLaunchStartTime) external'
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
        "launchTime": "2024-12-19T10:00:00Z",
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
        "launchTime": "2024-12-20T15:30:00Z",
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

    // 2. Get launchpad status and available tokens
    console.log('\n💵 Checking launchpad status...');
    let launchStatus = 0;
    let availableTokens = 0n;
    let tokensSold = 0n;
    let quoteRaised = 0n;
    let tradeLocked = false;
    let isMigrated = false;
    
    try {
      // Get launch supply and timing from the contract
      const [launchSupply, launchStart, launchEnd] = await Promise.all([
        launchpad.launchTokensSupply(),
        launchpad.launchStart(),
        launchpad.launchEnd()
      ]);
      
      [launchStatus, availableTokens, tokensSold, quoteRaised, tradeLocked, isMigrated] = await Promise.all([
        launchpad.launchStatus(),
        launchpad.getAvailableTokensToBuy(),
        launchpad.tokensSold(),
        launchpad.quoteRaised(),
        launchpad.tradeLocked(),
        launchpad.migrated()
      ]);
      console.log(`   Launch Supply: ${ethers.formatUnits(launchSupply, 18)} tokens`);
      console.log(`   Launch Start: ${new Date(launchStart * 1000).toLocaleString()}`);
      console.log(`   Launch End: ${new Date(launchEnd * 1000).toLocaleString()}`);
      console.log(`   Launch Status: ${launchStatus} (0=PRE_LAUNCH, 1=LAUNCHED, 2=LAUNCH_SUCCEEDED, 3=LAUNCH_FAILED)`);
      console.log(`   Available Tokens: ${ethers.formatUnits(availableTokens, 18)}`);
      console.log(`   Tokens Sold: ${ethers.formatUnits(tokensSold, 18)}`);
      console.log(`   Quote Raised: ${ethers.formatUnits(quoteRaised, 6)} USDC`);
      console.log(`   Trade Locked: ${tradeLocked ? 'YES' : 'NO'}`);
      console.log(`   Migrated: ${isMigrated ? 'YES' : 'NO'}`);
      
      // Safety checks
      if (tradeLocked) {
        throw new Error('Launchpad trading is locked');
      }
      if (isMigrated) {
        throw new Error('Launchpad already migrated');
      }
      if (launchStatus !== 1) {
        throw new Error(`Launch not in progress (status: ${launchStatus})`);
      }
    } catch (e) {
      console.log('   ⚠️  Could not fetch launchpad status:', e.message);
      throw e;
    }

    // 2b. Get additional contract parameters
    console.log('\n⚙️  Fetching contract parameters...');
    try {
      const [buyFeeRate, sellFeeRate, domainOwner, buySellFeeRecipient] = await Promise.all([
        launchpad.buyFeeRateBps(),
        launchpad.sellFeeRateBps(),
        launchpad.domainOwner(),
        launchpad.buySellFeeRecipient()
      ]);
      
      console.log(`   Buy Fee Rate: ${buyFeeRate / 100}%`);
      console.log(`   Sell Fee Rate: ${sellFeeRate / 100}%`);
      console.log(`   Domain Owner: ${domainOwner}`);
      console.log(`   Fee Recipient: ${buySellFeeRecipient}`);
    } catch (e) {
      console.log('   ⚠️  Could not fetch contract parameters:', e.message);
    }

    // 3. Calculate amounts
    const usdcAmount = ethers.parseUnits(config.usdcAmount, 6);

    // Calculate minTokenAmount with proper slippage protection
    let minTokenAmount = 0n;
    if (availableTokens > 0) {
      // Calculate expected token amount based on available supply ratio
      // This is a conservative estimate for slippage protection
      const totalSupplyRatio = availableTokens * 10000n / launchSupply;
      const expectedTokens = (usdcAmount * totalSupplyRatio) / 10000n;
      
      // Apply slippage protection
      const slippageBps = config.slippage * 100; // Convert percentage to basis points
      const minTokenAmountRaw = (expectedTokens * (10000n - BigInt(slippageBps))) / 10000n;
      
      // Ensure minTokenAmount is at least 1 token if expectedTokens > 0
      minTokenAmount = minTokenAmountRaw > 0n ? minTokenAmountRaw : 1n;
      
      console.log(`   Expected Tokens: ${ethers.formatUnits(expectedTokens, 18)}`);
      console.log(`   Min Token Amount (with ${config.slippage}% slippage): ${ethers.formatUnits(minTokenAmount, 18)}`);
      console.log(`   Slippage protection: ${config.slippage}%`);
    } else {
      console.log('   ⚠️  No tokens available for purchase');
      throw new Error('No tokens available for purchase');
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
    // Handle gas price properly - if it contains decimal, treat as gwei, otherwise as wei
    let maxGasPrice;
    if (config.maxGasPrice.includes('.')) {
      maxGasPrice = ethers.parseUnits(config.maxGasPrice, 'gwei');
      console.log(`   Max gas price: ${config.maxGasPrice} gwei`);
    } else {
      maxGasPrice = BigInt(config.maxGasPrice);
      console.log(`   Max gas price: ${config.maxGasPrice} wei`);
    }
    
    const maxPriorityFee = ethers.parseUnits('0.1', 'gwei'); // Fixed priority
    console.log(`   Priority fee: 0.1 gwei`);

    // 6. Execute transaction
    console.log('\n📤 Sending transaction...');

    // Get current nonce to avoid nonce conflicts
    const nonce = await this.provider.getTransactionCount(this.wallet.address, 'latest');
    console.log(`   Using nonce: ${nonce}`);

    try {
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
      
    } catch (error) {
      // Enhanced error handling for specific contract reverts
      if (error.message.includes('SlippageTooHigh')) {
        throw new Error(`Slippage too high. Expected at least ${ethers.formatUnits(minTokenAmount, 18)} tokens but got less. Try increasing slippage tolerance.`);
      } else if (error.message.includes('LaunchNotInProgress')) {
        throw new Error('Launch not in progress');
      } else if (error.message.includes('LaunchpadPaused')) {
        throw new Error('Launchpad trading paused');
      } else if (error.message.includes('TradeLockStatusChanged')) {
        throw new Error('Launchpad trading is locked');
      } else if (error.message.includes('LaunchNotFailed')) {
        throw new Error('Launch not failed');
      } else {
        throw error; // Re-throw unknown errors
      }
    }
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