// Gas Calculator for Doma Sniper
// Usage: node gas-calculator.js

const fs = require('fs');

const APPROVAL_GAS = 100000;
const BUY_GAS_ESTIMATE = 250000;
const ETH_PRICE_USD = 3000; // Update this based on current price

function calculateGasCost(gasUnits, gasPriceGwei) {
  const gasPriceWei = gasPriceGwei * 1e9; // Convert gwei to wei
  const gasCostWei = BigInt(gasUnits) * BigInt(Math.round(gasPriceWei));
  const gasCostEth = Number(gasCostWei) / 1e18;
  const gasCostUsd = gasCostEth * ETH_PRICE_USD;
  return { eth: gasCostEth, usd: gasCostUsd };
}

function analyzeSchedule() {
  const SCHEDULE_FILE = './schedule.json';
  
  if (!fs.existsSync(SCHEDULE_FILE)) {
    console.log('❌ schedule.json not found');
    return;
  }
  
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  const enabled = schedule.filter(s => s.enabled);
  
  if (enabled.length === 0) {
    console.log('❌ No enabled schedules');
    return;
  }
  
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║        GAS COST CALCULATOR               ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  console.log(`ETH Price: $${ETH_PRICE_USD}\n`);
  
  let totalMinEth = 0;
  let totalMaxEth = 0;
  let totalUSDC = 0;
  
  console.log('📊 Per Schedule Analysis:\n');
  
  enabled.forEach((item, idx) => {
    console.log(`[${idx + 1}] ${item.domain}`);
    
    const gasLimit = Math.floor(BUY_GAS_ESTIMATE * item.gasMultiplier);
    const maxGasPriceGwei = parseFloat(item.maxGasPrice);
    
    // Single attempt cost
    const singleAttempt = calculateGasCost(gasLimit, maxGasPriceGwei);

    // Min cost (1 attempt + approval if first)
    const minGas = idx === 0 ? APPROVAL_GAS + gasLimit : gasLimit;
    const minCost = calculateGasCost(minGas, maxGasPriceGwei);

    // Max cost (all retries + approval if first)
    const maxGas = (idx === 0 ? APPROVAL_GAS : 0) + (gasLimit * item.retryAttempts);
    const maxCost = calculateGasCost(maxGas, maxGasPriceGwei);
    
    console.log(`   Gas limit: ${gasLimit.toLocaleString()} (${item.gasMultiplier}x)`);
    console.log(`   Max gas price: ${maxGasPriceGwei} gwei`);
    console.log(`   Retry attempts: ${item.retryAttempts}`);
    console.log(`   Single attempt: ${singleAttempt.eth.toFixed(6)} ETH ($${singleAttempt.usd.toFixed(2)})`);
    console.log(`   Min cost: ${minCost.eth.toFixed(6)} ETH ($${minCost.usd.toFixed(2)})`);
    console.log(`   Max cost: ${maxCost.eth.toFixed(6)} ETH ($${maxCost.usd.toFixed(2)})`);
    console.log(`   USDC needed: ${item.usdcAmount} USDC`);
    console.log('');
    
    totalMinEth += minCost.eth;
    totalMaxEth += maxCost.eth;
    totalUSDC += parseFloat(item.usdcAmount);
  });
  
  console.log('═'.repeat(45));
  console.log('\n💰 TOTAL REQUIRED:\n');
  console.log(`Best case (all succeed first try):`);
  console.log(`   ${totalMinEth.toFixed(6)} ETH ($${(totalMinEth * ETH_PRICE_USD).toFixed(2)})`);
  console.log('');
  console.log(`Worst case (all max retries):`);
  console.log(`   ${totalMaxEth.toFixed(6)} ETH ($${(totalMaxEth * ETH_PRICE_USD).toFixed(2)})`);
  console.log('');
  console.log(`USDC needed: ${totalUSDC} USDC`);
  console.log('');
  
  console.log('═'.repeat(45));
  console.log('\n📋 RECOMMENDED BALANCE:\n');
  
  const recommendedEth = totalMaxEth * 1.2; // +20% buffer
  const recommendedUSDC = totalUSDC * 1.2; // +20% buffer
  
  console.log(`Native Token: ${recommendedEth.toFixed(4)} ETH ($${(recommendedEth * ETH_PRICE_USD).toFixed(2)})`);
  console.log(`USDC: ${recommendedUSDC.toFixed(2)} USDC`);
  console.log('\n(Includes 20% safety buffer)\n');
}

function showGasTable() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║         GAS COST REFERENCE TABLE         ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const gasPrices = [100, 150, 200, 300, 500];
  const multipliers = [1.3, 1.5, 2.0];
  
  console.log('Gas cost per transaction:\n');
  console.log('Gas Price | 1.3x Multiplier | 1.5x Multiplier | 2.0x Multiplier');
  console.log('----------|-----------------|-----------------|----------------');
  
  gasPrices.forEach(price => {
    const costs = multipliers.map(mult => {
      const gasLimit = Math.floor(BUY_GAS_ESTIMATE * mult);
      const cost = calculateGasCost(gasLimit, price);
      return `${cost.eth.toFixed(4)} ETH`;
    });
    
    console.log(`${price} gwei  | ${costs[0].padEnd(15)} | ${costs[1].padEnd(15)} | ${costs[2]}`);
  });
  
  console.log('\n💡 Tips:');
  console.log('   • Higher gas price = faster execution');
  console.log('   • Higher multiplier = more safety buffer');
  console.log('   • Balance speed vs cost based on importance');
  console.log('');
}

function estimateForCustom() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║       CUSTOM GAS ESTIMATION              ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  rl.question('Gas multiplier (1.5): ', (mult) => {
    rl.question('Max gas price gwei (200): ', (price) => {
      rl.question('Retry attempts (3): ', (retry) => {
        rl.question('Number of schedules (1): ', (num) => {
          
          const multiplier = parseFloat(mult) || 1.5;
          const gasPrice = parseInt(price) || 200;
          const retryAttempts = parseInt(retry) || 3;
          const numSchedules = parseInt(num) || 1;
          
          const gasLimit = Math.floor(BUY_GAS_ESTIMATE * multiplier);
          
          // Single attempt
          const single = calculateGasCost(gasLimit, gasPrice);
          
          // Per schedule
          const perScheduleMin = calculateGasCost(APPROVAL_GAS + gasLimit, gasPrice);
          const perScheduleMax = calculateGasCost(APPROVAL_GAS + (gasLimit * retryAttempts), gasPrice);
          
          // Total
          const totalMin = calculateGasCost(APPROVAL_GAS + (gasLimit * numSchedules), gasPrice);
          const totalMax = calculateGasCost(APPROVAL_GAS + (gasLimit * retryAttempts * numSchedules), gasPrice);
          
          console.log('\n📊 Results:\n');
          console.log('Settings:');
          console.log(`   Multiplier: ${multiplier}x`);
          console.log(`   Gas price: ${gasPrice} gwei`);
          console.log(`   Gas limit: ${gasLimit.toLocaleString()}`);
          console.log(`   Retries: ${retryAttempts}`);
          console.log(`   Schedules: ${numSchedules}`);
          console.log('');
          console.log('Cost per attempt:');
          console.log(`   ${single.eth.toFixed(6)} ETH ($${single.usd.toFixed(2)})`);
          console.log('');
          console.log('Total cost:');
          console.log(`   Best case: ${totalMin.eth.toFixed(6)} ETH ($${totalMin.usd.toFixed(2)})`);
          console.log(`   Worst case: ${totalMax.eth.toFixed(6)} ETH ($${totalMax.usd.toFixed(2)})`);
          console.log('');
          console.log('Recommended balance:');
          console.log(`   ${(totalMax.eth * 1.2).toFixed(4)} ETH (worst case + 20%)`);
          console.log('');
          
          rl.close();
        });
      });
    });
  });
}

// Main
const args = process.argv.slice(2);

if (args[0] === 'table') {
  showGasTable();
} else if (args[0] === 'custom') {
  estimateForCustom();
} else if (args[0] === 'analyze' || args.length === 0) {
  analyzeSchedule();
} else {
  console.log('\nUsage:');
  console.log('  node gas-calculator.js           -> Analyze schedule.json');
  console.log('  node gas-calculator.js analyze   -> Same as above');
  console.log('  node gas-calculator.js table     -> Show gas cost table');
  console.log('  node gas-calculator.js custom    -> Custom estimation');
  console.log('');
}