const { ethers } = require('ethers');
require('dotenv').config();

async function testWalletRecovery() {
    try {
        console.log('=== Testing Multiple Wallet Recovery ===\n');
        
        // Get RPC URL from .env
        const rpcUrl = process.env.RPC_URL;
        
        if (!rpcUrl) {
            console.error('❌ Error: RPC_URL not found in .env file');
            return;
        }
        
        console.log('🌐 RPC URL:', rpcUrl);
        
        // Create provider
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // USDC.e contract address (you need to set this in .env)
        const usdcAddress = process.env.USDC;
        
        if (!usdcAddress) {
            console.error('❌ Error: USDC contract address not found in .env file');
            return;
        }
        
        console.log('💵 USDC.e Address:', usdcAddress);
        console.log('\n');
        
        // USDC.e ABI (minimal ABI for balanceOf)
        const usdcAbi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        // Create USDC contract instance
        const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);
        
        // Get USDC decimals
        const decimals = await usdcContract.decimals();
        console.log('📊 USDC Decimals:', decimals);
        console.log('\n');
        
        // Array of private key environment variable names
        const privateKeyVars = ['PRIVKEY1', 'PRIVKEY2', 'PRIVKEY3'];
        
        // Process each wallet
        for (let i = 0; i < privateKeyVars.length; i++) {
            const keyVar = privateKeyVars[i];
            const privateKey = process.env[keyVar];
            
            console.log(`=== Wallet ${i + 1} (${keyVar}) ===`);
            
            if (!privateKey) {
                console.log(`⚠️  Warning: ${keyVar} not found in .env file\n`);
                continue;
            }
            
            try {
                // Create wallet from private key
                const wallet = new ethers.Wallet(privateKey, provider);
                
                console.log('✅ Wallet successfully created!');
                console.log('📍 Address:', wallet.address);
                
                // Verify private key format
                if (privateKey.startsWith('0x')) {
                    console.log('✅ Private key has correct 0x prefix');
                } else {
                    console.log('⚠️  Warning: Private key should start with 0x');
                }
                
                // Get ETH balance
                const ethBalance = await provider.getBalance(wallet.address);
                const ethFormatted = ethers.formatEther(ethBalance);
                console.log('💰 ETH Balance:', ethFormatted, 'ETH');
                
                // Get USDC.e balance
                const usdcBalance = await usdcContract.balanceOf(wallet.address);
                const usdcFormatted = ethers.formatUnits(usdcBalance, decimals);
                console.log('💵 USDC.e Balance:', usdcFormatted, 'USDC.e');
                
                // Test signing capability
                const testMessage = `Test message for wallet ${i + 1}`;
                const signature = await wallet.signMessage(testMessage);
                console.log('✅ Wallet can sign messages');
                
                // Verify signature
                const recoveredAddress = ethers.verifyMessage(testMessage, signature);
                if (recoveredAddress.toLowerCase() === wallet.address.toLowerCase()) {
                    console.log('✅ Signature verification successful');
                } else {
                    console.log('❌ Signature verification failed');
                }
                
                console.log('\n');
                
            } catch (error) {
                console.error(`❌ Error processing ${keyVar}:`, error.message);
                
                if (error.message.includes('invalid private key')) {
                    console.log('💡 Private key format is incorrect');
                }
                console.log('\n');
            }
        }
        
        console.log('=== All Wallet Recovery Tests Complete ===');
        
    } catch (error) {
        console.error('❌ Error in wallet recovery test:', error.message);
        
        if (error.message.includes('could not detect network')) {
            console.log('\n💡 Possible issues:');
            console.log('- RPC URL is incorrect or unreachable');
            console.log('- Network connection issue');
        }
    }
}

// Run the test
testWalletRecovery();
