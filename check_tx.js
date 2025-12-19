require('dotenv').config();
const { ethers } = require('ethers');

const RPC_URL = 'https://doma.drpc.org';
const DOMA_LAUNCHPAD = '0x27E022E96287F93ed69B12e10BaCd362a821Fa1f';

const LAUNCHPAD_ABI = [
  'function buy(uint256 quoteAmount, uint256 minTokenAmount) external payable'
];

async function checkTransaction() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const txHash = '0xf09b6ab992cb9a1fd9c467c69bb639e0a5d54f963b0ae684157b2a50b61354ac';

  try {
    const tx = await provider.getTransaction(txHash);
    console.log('Transaction to:', tx.to);
    console.log('Value:', tx.value.toString());
    console.log('Data:', tx.data);

    console.log('tx.to:', tx.to);
    console.log('DOMA_LAUNCHPAD:', DOMA_LAUNCHPAD);
    console.log('compare:', tx.to.toLowerCase() === DOMA_LAUNCHPAD.toLowerCase());
    if (tx.to.toLowerCase() === DOMA_LAUNCHPAD.toLowerCase()) {
      console.log('Transaction is to the launchpad contract.');

      // Decode the data
      const iface = new ethers.Interface(LAUNCHPAD_ABI);
      try {
        const decoded = iface.decodeFunctionData('buy', tx.data);
        console.log('Decoded function call: buy');
        console.log('Quote Amount:', decoded[0].toString());
        console.log('Min Token Amount:', decoded[1].toString());
      } catch (e) {
        console.log('Failed to decode with ABI:', e.message);
        // Manual decode
        const data = tx.data.slice(2);
        const sig = data.slice(0, 8);
        console.log('Function sig:', '0x' + sig);
        const param1 = data.slice(8, 72);
        const param2 = data.slice(72, 136);
        console.log('Quote Amount:', BigInt('0x' + param1).toString());
        console.log('Min Token Amount:', BigInt('0x' + param2).toString());
      }
    } else {
      console.log('Transaction is not to the launchpad contract.');
    }
  } catch (error) {
    console.error('Error fetching transaction:', error);
  }
}

checkTransaction();