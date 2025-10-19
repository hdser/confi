#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function setupComplete() {
  console.log('🔧 ConFi Complete Setup Script\n');
  console.log('================================\n');

  // Step 1: Generate signing keys if they don't exist
  let signingKeys;
  if (!fs.existsSync('signing-keys.json')) {
    console.log('Step 1: Generating signing keys...');
    
    const invoiceWallet = ethers.Wallet.createRandom();
    const payrollWallet = ethers.Wallet.createRandom();
    
    signingKeys = {
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
    console.log('Step 1: Using existing signing keys ✔');
    signingKeys = JSON.parse(fs.readFileSync('signing-keys.json', 'utf8'));
  }
  
  // Step 2: Configure invoice app secret
  console.log('\nStep 2: Configuring invoice app secret...');
  
  const iappConfigPath = path.join(__dirname, '../src/iapp/iapp.config.json');
  
  // Read existing config or create default
  let iappConfig;
  if (fs.existsSync(iappConfigPath)) {
    iappConfig = JSON.parse(fs.readFileSync(iappConfigPath, 'utf8'));
  } else {
    iappConfig = {
      defaultChain: "bellecour",
      projectName: "confi-invoice",
      template: "JavaScript",
      dockerhubUsername: process.env.DOCKER_USERNAME || "your-dockerhub-username"
    };
  }
  
  // Create app secret JSON string with proper structure
  const invoiceSecret = JSON.stringify({
    VOUCHER_SIGNING_KEY: signingKeys.invoice.privateKey,
    signingKey: signingKeys.invoice.privateKey
  });
  
  iappConfig.appSecret = invoiceSecret;
  fs.writeFileSync(iappConfigPath, JSON.stringify(iappConfig, null, 2));
  console.log('✅ Invoice app secret configured');
  
  // Step 3: Create payroll config
  console.log('\nStep 3: Creating payroll configuration...');
  
  const payrollConfigPath = path.join(__dirname, '../src/iapp/iapp-payroll.config.json');
  const payrollConfig = { ...iappConfig };
  
  // Create payroll app secret
  const payrollSecret = JSON.stringify({
    VOUCHER_SIGNING_KEY: signingKeys.payroll.privateKey,
    signingKey: signingKeys.payroll.privateKey
  });
  
  payrollConfig.appSecret = payrollSecret;
  payrollConfig.projectName = "confi-payroll";
  
  fs.writeFileSync(payrollConfigPath, JSON.stringify(payrollConfig, null, 2));
  console.log('✅ Payroll configuration created');
  
  // Step 4: Authorize signers in settlement contract (if deployed)
  if (process.env.SETTLEMENT_CONTRACT && process.env.PRIVATE_KEY) {
    console.log('\nStep 4: Authorizing signers in settlement contract...');
    
    try {
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      
      const balance = await provider.getBalance(wallet.address);
      console.log('   Wallet balance:', ethers.formatEther(balance), 'ETH');
      
      if (balance === 0n) {
        console.log('   ⚠️ No ETH for gas fees');
        console.log('   Get ETH from: https://faucet.quicknode.com/arbitrum/sepolia');
        console.log('   Then run: npm run setup:signers');
      } else {
        const settlementABI = [
          'function updateAuthorizedSigner(address signer, bool authorized) external',
          'function authorizedSigners(address) view returns (bool)'
        ];
        
        const settlement = new ethers.Contract(
          process.env.SETTLEMENT_CONTRACT,
          settlementABI,
          wallet
        );
        
        // Check if already authorized
        const invoiceAuth = await settlement.authorizedSigners(signingKeys.invoice.address);
        const payrollAuth = await settlement.authorizedSigners(signingKeys.payroll.address);
        
        if (!invoiceAuth) {
          console.log('   Authorizing invoice signer...');
          const tx1 = await settlement.updateAuthorizedSigner(signingKeys.invoice.address, true);
          await tx1.wait();
          console.log('   ✅ Invoice signer authorized');
        } else {
          console.log('   ✅ Invoice signer already authorized');
        }
        
        if (!payrollAuth) {
          console.log('   Authorizing payroll signer...');
          const tx2 = await settlement.updateAuthorizedSigner(signingKeys.payroll.address, true);
          await tx2.wait();
          console.log('   ✅ Payroll signer authorized');
        } else {
          console.log('   ✅ Payroll signer already authorized');
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      console.log('   Run manually later: npm run setup:signers');
    }
  } else {
    console.log('\nStep 4: Skipping signer authorization (no contract deployed yet)');
    console.log('   Deploy contract first: npm run deploy:contracts');
    console.log('   Then run: npm run setup:signers');
  }
  
  // Create .env template if it doesn't exist
  if (!fs.existsSync('.env')) {
    console.log('\nCreating .env template...');
    const envTemplate = `# Network Configuration
NETWORK=arbitrum-sepolia
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
CHAIN_ID=421614

# Your wallet private key (NEVER commit this)
PRIVATE_KEY=0xYourPrivateKeyHere

# DockerHub credentials
DOCKER_USERNAME=${process.env.DOCKER_USERNAME || 'your-dockerhub-username'}

# Deployed contracts (will be populated during deployment)
SETTLEMENT_CONTRACT=
INVOICE_IAPP_ADDRESS=
PAYROLL_IAPP_ADDRESS=

# Frontend configuration
REACT_APP_NETWORK=arbitrum-sepolia
REACT_APP_CHAIN_ID=421614
REACT_APP_SETTLEMENT_CONTRACT=
REACT_APP_INVOICE_IAPP_ADDRESS=
REACT_APP_PAYROLL_IAPP_ADDRESS=
`;
    fs.writeFileSync('.env', envTemplate);
    console.log('✅ .env template created');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ SETUP COMPLETE!\n');
  console.log('Generated Files:');
  console.log('  - signing-keys.json (KEEP SECURE!)');
  console.log('  - src/iapp/iapp.config.json (with invoice secret)');
  console.log('  - src/iapp/iapp-payroll.config.json (with payroll secret)');
  console.log('\nSigner Addresses:');
  console.log('  Invoice:', signingKeys.invoice.address);
  console.log('  Payroll:', signingKeys.payroll.address);
  console.log('\n⚠️ IMPORTANT: Keep signing-keys.json secure and never commit it!');
  console.log('\nNext Steps:');
  console.log('1. Deploy contracts: npm run deploy:contracts');
  console.log('2. Deploy iApps: npm run deploy:iapps');
  console.log('3. Start frontend: npm run dev');
}

setupComplete().catch(console.error);