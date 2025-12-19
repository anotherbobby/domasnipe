// Test script to verify wallet address and RPC connection
require('dotenv').config();
const { ethers } = require('ethers');

// Configuration
const RPC_URL = 'https://doma.drpc.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

console.log('🔍 Testing Wallet and RPC Configuration\n');

// 1. Check if private key is loaded
if (!PRIVATE_KEY || PRIVATE_KEY === 'your_private_key_here') {
  console.error('❌ Private key not set in .env file');
  process.exit(1);
}

console.log('✅ Private key loaded from .env');

// 2. Create wallet and get address
try {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('📍 Wallet Address:', wallet.address);
  console.log('✅ Wallet created successfully');
  
  // 3. Test RPC connection
  console.log('\n🌐 Testing RPC connection...');
  provider.getBlockNumber().then(blockNumber => {
    console.log('✅ RPC Connection OK');
    console.log('📊 Current Block:', blockNumber);
    console.log('\n🎉 All checks passed!');
  }).catch(error => {
    console.error('❌ RPC Connection Failed:', error.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Wallet creation failed:', error.message);
  process.exit(1);
}