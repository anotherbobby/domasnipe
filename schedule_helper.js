// Schedule Helper - Easy schedule management
// Usage: node schedule-helper.js [command]
// Format: Mengikuti struktur schedule.json

const fs = require('fs');
const readline = require('readline');

const SCHEDULE_FILE = process.env.SCHEDULE_FILE || './schedule.json';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function loadSchedule() {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    return [];
  }
  const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
  return JSON.parse(data);
}

function saveSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
  console.log(`✅ Saved to ${SCHEDULE_FILE}`);
}

// Format sesuai schedule.json
async function addSchedule() {
  console.log('\n📝 Add New Launch Schedule\n');
  
  const domain = await question('Domain name (e.g., JINGLEBELLS.io): ');
  const tokenAddress = await question('Token address (0x...): ');
  const launchpadAddress = await question('Launchpad address (0x...): ');
  
  // Date input sesuai format schedule.json
  console.log('\n⏰ Launch Time (UTC)');
  console.log('   Format: YYYY-MM-DD HH:MM');
  console.log('   Example: 2025-12-24 14:00');
  const launchInput = await question('Launch time: ');
  
  // Konversi format YYYY-MM-DD HH:MM ke ISO 8601
  let launchTime;
  try {
    // Tambahkan :00:00Z untuk membuat format ISO 8601
    const isoFormat = launchInput + ':00:00Z';
    launchTime = new Date(isoFormat).toISOString();
  } catch (e) {
    console.log('❌ Invalid date format, using current time');
    launchTime = new Date().toISOString();
  }
  
  const usdcAmount = await question('USDC amount (e.g., 5): ');
  const slippage = await question('Slippage % (default 15): ') || '15';
  const gasMultiplier = await question('Gas multiplier (default 1.5): ') || '1.5';
  const maxGasPrice = await question('Max gas price (default 0.3): ') || '0.3';
  const retryAttempts = await question('Retry attempts (default 3): ') || '3';
  const retryDelayMs = await question('Retry delay ms (default 1000): ') || '1000';
  const notes = await question('Notes (optional): ');
  
  const newEntry = {
    enabled: true,
    domain,
    tokenAddress,
    launchpadAddress,
    launchTime,
    usdcAmount,
    slippage: parseInt(slippage),
    gasMultiplier: parseFloat(gasMultiplier),
    maxGasPrice,
    retryAttempts: parseInt(retryAttempts),
    retryDelayMs: parseInt(retryDelayMs),
    notes
  };
  
  const schedule = loadSchedule();
  schedule.push(newEntry);
  saveSchedule(schedule);
  
  console.log('\n✅ Schedule added!');
  console.log(JSON.stringify(newEntry, null, 2));
}

function listSchedule() {
  const schedule = loadSchedule();
  
  if (schedule.length === 0) {
    console.log('\n📋 No schedules found\n');
    return;
  }
  
  console.log('\n📋 Current Schedules\n');
  
  const now = new Date();
  schedule.forEach((item, idx) => {
    const status = item.enabled ? '🟢' : '🔴';
    const launchDate = new Date(item.launchTime);
    const isPast = launchDate < now;
    
    console.log(`${status} [${idx + 1}] ${item.domain}`);
    console.log(`   Token: ${item.tokenAddress}`);
    console.log(`   Launchpad: ${item.launchpadAddress}`);
    console.log(`   Launch: ${launchDate.toLocaleString()} ${isPast ? '⚠️ PAST' : ''}`);
    console.log(`   Amount: ${item.usdcAmount} USDC`);
    console.log(`   Settings: Slippage ${item.slippage}% | Gas ${item.gasMultiplier}x | Max ${item.maxGasPrice}`);
    console.log(`   Retry: ${item.retryAttempts} attempts, ${item.retryDelayMs}ms delay`);
    if (item.notes) console.log(`   Notes: ${item.notes}`);
    console.log('');
  });
}

async function removeSchedule() {
  listSchedule();
  
  const schedule = loadSchedule();
  if (schedule.length === 0) return;
  
  const index = await question('\nRemove schedule #: ');
  const idx = parseInt(index) - 1;
  
  if (idx < 0 || idx >= schedule.length) {
    console.log('❌ Invalid index');
    return;
  }
  
  const removed = schedule.splice(idx, 1)[0];
  saveSchedule(schedule);
  
  console.log(`\n✅ Removed: ${removed.domain}`);
}

async function toggleSchedule() {
  listSchedule();
  
  const schedule = loadSchedule();
  if (schedule.length === 0) return;
  
  const index = await question('\nToggle schedule #: ');
  const idx = parseInt(index) - 1;
  
  if (idx < 0 || idx >= schedule.length) {
    console.log('❌ Invalid index');
    return;
  }
  
  schedule[idx].enabled = !schedule[idx].enabled;
  saveSchedule(schedule);
  
  const status = schedule[idx].enabled ? 'ENABLED' : 'DISABLED';
  console.log(`\n✅ ${schedule[idx].domain} is now ${status}`);
}

async function editSchedule() {
  listSchedule();
  
  const schedule = loadSchedule();
  if (schedule.length === 0) return;
  
  const index = await question('\nEdit schedule #: ');
  const idx = parseInt(index) - 1;
  
  if (idx < 0 || idx >= schedule.length) {
    console.log('❌ Invalid index');
    return;
  }
  
  const item = schedule[idx];
  console.log(`\nEditing: ${item.domain}`);
  console.log('Press Enter to keep current value\n');
  
  const domain = await question(`Domain [${item.domain}]: `) || item.domain;
  const tokenAddress = await question(`Token [${item.tokenAddress}]: `) || item.tokenAddress;
  const launchpadAddress = await question(`Launchpad [${item.launchpadAddress}]: `) || item.launchpadAddress;
  const launchInput = await question(`Launch time [${item.launchTime}]: `);
  const launchTime = launchInput ? new Date(launchInput + ':00:00Z').toISOString() : item.launchTime;
  const usdcAmount = await question(`USDC amount [${item.usdcAmount}]: `) || item.usdcAmount;
  const slippage = await question(`Slippage % [${item.slippage}]: `) || item.slippage;
  const gasMultiplier = await question(`Gas multiplier [${item.gasMultiplier}]: `) || item.gasMultiplier;
  const maxGasPrice = await question(`Max gas price [${item.maxGasPrice}]: `) || item.maxGasPrice;
  const retryAttempts = await question(`Retry attempts [${item.retryAttempts}]: `) || item.retryAttempts;
  const retryDelayMs = await question(`Retry delay ms [${item.retryDelayMs}]: `) || item.retryDelayMs;
  const notes = await question(`Notes [${item.notes}]: `) || item.notes;
  
  schedule[idx] = {
    ...item,
    domain,
    tokenAddress,
    launchpadAddress,
    launchTime,
    usdcAmount,
    slippage: parseInt(slippage),
    gasMultiplier: parseFloat(gasMultiplier),
    maxGasPrice,
    retryAttempts: parseInt(retryAttempts),
    retryDelayMs: parseInt(retryDelayMs),
    notes
  };
  
  saveSchedule(schedule);
  console.log('\n✅ Schedule updated!');
}

function clearSchedule() {
  saveSchedule([]);
  console.log('\n✅ All schedules cleared!');
}

// Quick add sesuai format schedule.json
function quickAdd(domain, tokenAddress, launchpadAddress, launchTime, usdcAmount, slippage = 15, gasMultiplier = 1.5, maxGasPrice = "0.3", retryAttempts = 3, retryDelayMs = 1000, notes = "") {
  const schedule = loadSchedule();
  
  schedule.push({
    enabled: true,
    domain,
    tokenAddress,
    launchpadAddress,
    launchTime: new Date(launchTime).toISOString(),
    usdcAmount,
    slippage,
    gasMultiplier,
    maxGasPrice,
    retryAttempts,
    retryDelayMs,
    notes
  });
  
  saveSchedule(schedule);
  console.log(`\n✅ Quick added: ${domain}`);
}

async function showMenu() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║      DOMA SCHEDULE HELPER v1.0           ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  console.log('1. Add new schedule');
  console.log('2. List schedules');
  console.log('3. Edit schedule');
  console.log('4. Toggle enable/disable');
  console.log('5. Remove schedule');
  console.log('6. Clear all schedules');
  console.log('7. Exit\n');
  
  const choice = await question('Choose option: ');
  
  switch(choice) {
    case '1':
      await addSchedule();
      break;
    case '2':
      listSchedule();
      break;
    case '3':
      await editSchedule();
      break;
    case '4':
      await toggleSchedule();
      break;
    case '5':
      await removeSchedule();
      break;
    case '6':
      clearSchedule();
      break;
    case '7':
      console.log('\n👋 Goodbye!\n');
      rl.close();
      return;
    default:
      console.log('\n❌ Invalid option');
  }
  
  await showMenu();
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  // Quick add mode sesuai format schedule.json
  if (args[0] === 'quick' && args.length >= 5) {
    // node schedule-helper.js quick "JINGLEBELLS.io" "0xd00000009284eFaa55c228523294BFE80dDbffb3" "0x997ba7E4dC31b0615FB7aAA0Be72Dd611a4d193d" "2025-12-24 14:00" "5"
    quickAdd(args[1], args[2], args[3], args[4], args[5],
            args[6] ? parseInt(args[6]) : 15,
            args[7] ? parseFloat(args[7]) : 1.5,
            args[8] || "0.3",
            args[9] ? parseInt(args[9]) : 3,
            args[10] ? parseInt(args[10]) : 1000,
            args[11] || "");
    rl.close();
    return;
  }
  
  // List mode
  if (args[0] === 'list') {
    listSchedule();
    rl.close();
    return;
  }
  
  // Interactive menu
  await showMenu();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});