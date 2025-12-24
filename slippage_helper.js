// Helper script to calculate recommended slippage for different token types
// Usage: node slippage_helper.js [tokenPriceInUSDC] [usdcAmount]

const { ethers } = require('ethers');

function calculateRecommendedSlippage(tokenPrice, usdcAmount = 5) {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   SLIPPAGE CALCULATOR HELPER              ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  console.log(`Token Price: ${tokenPrice} USDC`);
  console.log(`USDC Amount: ${usdcAmount} USDC\n`);
  
  // Calculate expected tokens (simplified calculation)
  const expectedTokens = (usdcAmount / tokenPrice);
  console.log(`Expected Tokens: ${expectedTokens.toLocaleString()}\n`);
  
  // Determine slippage category
  let category = '';
  let baseSlippage = 0;
  let maxSlippage = 0;
  
  if (tokenPrice < 0.001) {
    category = '💎 VERY LOW PRICE TOKEN';
    baseSlippage = 25;
    maxSlippage = 90;
  } else if (tokenPrice < 0.01) {
    category = '💰 LOW PRICE TOKEN';
    baseSlippage = 15;
    maxSlippage = 70;
  } else if (tokenPrice < 0.1) {
    category = '📊 MID PRICE TOKEN';
    baseSlippage = 10;
    maxSlippage = 50;
  } else {
    category = '📈 NORMAL PRICE TOKEN';
    baseSlippage = 5;
    maxSlippage = 20;
  }
  
  console.log(`Category: ${category}`);
  console.log(`Recommended Slippage: ${baseSlippage}% (max ${maxSlippage}%)\n`);
  
  // Calculate min token amount for different slippage levels
  const slippageLevels = [baseSlippage, baseSlippage * 1.5, baseSlippage * 2];
  
  console.log('Min Token Amounts at Different Slippage Levels:');
  slippageLevels.forEach(slippage => {
    if (slippage <= maxSlippage) {
      const minTokens = expectedTokens * (100 - slippage) / 100;
      console.log(`  ${slippage.toFixed(1)}% slippage: ${minTokens.toLocaleString()} tokens`);
    }
  });
  
  console.log('\n📝 Usage in schedule.json:');
  console.log(`{`);
  console.log(`  "slippage": ${baseSlippage},`);
  console.log(`  "notes": "Token price ~${tokenPrice} USDC - ${category}"`);
  console.log(`}\n`);
}

// Example usage
if (process.argv.length > 2) {
  const tokenPrice = parseFloat(process.argv[2]);
  const usdcAmount = process.argv[3] ? parseFloat(process.argv[3]) : 5;
  calculateRecommendedSlippage(tokenPrice, usdcAmount);
} else {
  console.log('Usage: node slippage_helper.js [tokenPriceInUSDC] [usdcAmount]');
  console.log('Examples:');
  console.log('  node slippage_helper.js 0.00002    # Very low price token');
  console.log('  node slippage_helper.js 0.005      # Low price token');
  console.log('  node slippage_helper.js 0.1        # Mid price token');
  console.log('  node slippage_helper.js 1.0        # Normal price token');
}