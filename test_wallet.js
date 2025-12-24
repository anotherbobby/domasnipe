const { ethers } = require('ethers');
require('dotenv').config();

async function testWalletRecovery() {
    try {
        console.log('=== Testing Wallet Recovery ===\n');
        
        // Get private key from .env
        const privateKey = process.env.PRIVATE_KEY;
        
        if (!privateKey) {
            console.error('❌ Error: PRIVATE_KEY not found in .env file');
            return;
        }
        
        console.log('🔑 Private Key:', privateKey);
        console.log('🔍 Testing wallet recovery...\n');
        
        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey);
        
        console.log('✅ Wallet successfully created!');
        console.log('📍 Wallet Address:', wallet.address);
        console.log('🔍 Checksum Address:', wallet.address);
        
        // Verify the private key format
        if (privateKey.startsWith('0x')) {
            console.log('✅ Private key has correct 0x prefix');
        } else {
            console.log('⚠️  Warning: Private key should start with 0x');
        }
        
        // Test signing capability
        const testMessage = 'Test message for signing';
        const signature = await wallet.signMessage(testMessage);
        console.log('✅ Wallet can sign messages');
        console.log('📝 Test signature:', signature);
        
        // Verify signature
        const recoveredAddress = ethers.verifyMessage(testMessage, signature);
        if (recoveredAddress.toLowerCase() === wallet.address.toLowerCase()) {
            console.log('✅ Signature verification successful');
        } else {
            console.log('❌ Signature verification failed');
        }
        
        console.log('\n=== Wallet Recovery Test Complete ===');
        console.log('✅ Private key is valid and can restore wallet');
        
    } catch (error) {
        console.error('❌ Error testing wallet recovery:', error.message);
        
        // Provide helpful error information
        if (error.message.includes('invalid private key')) {
            console.log('\n💡 Possible issues:');
            console.log('- Private key format is incorrect');
            console.log('- Private key contains invalid characters');
            console.log('- Private key length is wrong');
        }
    }
}

// Run the test
testWalletRecovery();