// Check Wallet Nonce
const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = 'https://doma.drpc.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function checkNonce() {
  const nonce = await provider.getTransactionCount(wallet.address, 'latest');
  console.log('📍 Wallet:', wallet.address);
  console.log('🔢 Current Nonce:', nonce);
  console.log('📝 Next transaction will use nonce:', nonce);
}

checkNonce();