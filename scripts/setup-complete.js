#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function setupComplete() {
  console.log('🔧 ConFi Complete Setup Script\n');
  console.log('================================\n');

  // Step 1: Generate signing keys if they don't exist
  if (!fs.existsSync('signing-keys.json')) {
    console.log('Step 1: Generating signing keys...');
    
    const invoiceWallet = ethers.Wallet.createRandom();
    const payrollWallet = ethers.Wallet.createRandom();
    
    const signingKeys = {
      generated: new Date().toISOString(),
      invoice: {
        privateKey: invoiceWallet.privateKey,
        address: invoiceWallet.address
      },
      payroll: {
        privateKey: payrollWallet.privateKey,
        address: payrollWallet.address
      }
    };
    
    fs.writeFileSync('signing-keys.json', JSON.stringify(signingKeys, null, 2));
    console.log('✅ Keys generated and saved');
    console.log('   Invoice signer:', invoiceWallet.address);
    console.log('   Payroll signer:', payrollWallet.address);
  } else {
    console.log('Step 1: Using existing signing keys ✓');
  }
  
  // Load keys
  const signingKeys = JSON.parse(fs.readFileSync('signing-keys.json', 'utf8'));
  
  // Step 2: Configure invoice app secret
  console.log('\nStep 2: Configuring invoice app secret...');
  
  const iappConfigPath = path.join(__dirname, '../src/iapp/iapp.config.json');
  const iappConfig = JSON.parse(fs.readFileSync(iappConfigPath, 'utf8'));
  
  const invoiceSecret = {
    VOUCHER_SIGNING_KEY: signingKeys.invoice.privateKey,
    IEXEC_APP_DEVELOPER_SECRET: signingKeys.invoice.privateKey
  };
  
  iappConfig.appSecret = JSON.stringify(invoiceSecret);
  fs.writeFileSync(iappConfigPath, JSON.stringify(iappConfig, null, 2));
  console.log('✅ Invoice app secret configured');
  
  // Step 3: Create payroll config
  console.log('\nStep 3: Creating payroll configuration...');
  
  const payrollConfigPath = path.join(__dirname, '../src/iapp/iapp-payroll.config.json');
  const payrollConfig = { ...iappConfig };
  
  const payrollSecret = {
    VOUCHER_SIGNING_KEY: signingKeys.payroll.privateKey,
    IEXEC_APP_DEVELOPER_SECRET: signingKeys.payroll.privateKey
  };
  
  payrollConfig.appSecret = JSON.stringify(payrollSecret);
  payrollConfig.projectName = "confi-payroll-platform";
  
  fs.writeFileSync(payrollConfigPath, JSON.stringify(payrollConfig, null, 2));
  console.log('✅ Payroll configuration created');
  
  // Step 4: Authorize signers (if contract is deployed)
  if (process.env.SETTLEMENT_CONTRACT && process.env.PRIVATE_KEY) {
    console.log('\nStep 4: Authorizing signers in settlement contract...');
    
    try {
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      
      const balance = await provider.getBalance(wallet.address);
      console.log('   Wallet balance:', ethers.formatEther(balance), 'ETH');
      
      if (balance === 0n) {
        console.log('   ⚠️  No ETH for gas fees');
        console.log('   Get ETH from: https://faucet.quicknode.com/arbitrum/sepolia');
        console.log('   Then run: npm run setup:signers');
        return;
      }
      
      const settlementABI = [
        'function updateAuthorizedSigner(address signer, bool authorized) external',
        'function authorizedSigners(address) view returns (bool)'
      ];
      
      const settlement = new ethers.Contract(
        process.env.SETTLEMENT_CONTRACT,
        settlementABI,
        wallet
      );
      
      // Authorize both signers
      console.log('   Authorizing invoice signer...');
      const tx1 = await settlement.updateAuthorizedSigner(signingKeys.invoice.address, true);
      await tx1.wait();
      console.log('   ✅ Invoice signer authorized');
      
      console.log('   Authorizing payroll signer...');
      const tx2 = await settlement.updateAuthorizedSigner(signingKeys.payroll.address, true);
      await tx2.wait();
      console.log('   ✅ Payroll signer authorized');
      
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      console.log('   Run manually: npm run setup:signers');
    }
  } else {
    console.log('\nStep 4: Skipping signer authorization (no contract deployed yet)');
    console.log('   Run after deploying contract: npm run setup:signers');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ SETUP COMPLETE!\n');
  console.log('Generated Files:');
  console.log('  - signing-keys.json');
  console.log('  - src/iapp/iapp.config.json (with invoice secret)');
  console.log('  - src/iapp/iapp-payroll.config.json (with payroll secret)');
  console.log('\nNext: Deploy iApps with: npm run deploy:iapps');
}

setupComplete().catch(console.error);