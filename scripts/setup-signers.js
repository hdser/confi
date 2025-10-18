#!/usr/bin/env node

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function setupSigners() {
  console.log('🔐 Setting up ConFi Signers...\n');
  
  // Check for required environment variables
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY || !process.env.SETTLEMENT_CONTRACT) {
    console.error('❌ Missing required environment variables');
    console.error('Please ensure .env contains: RPC_URL, PRIVATE_KEY, SETTLEMENT_CONTRACT');
    process.exit(1);
  }
  
  // Load signing keys
  const keysPath = path.join(__dirname, '../signing-keys.json');
  if (!fs.existsSync(keysPath)) {
    console.error('❌ No signing keys found. Run: npm run generate-keys');
    process.exit(1);
  }
  
  const signingKeys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
  
  // Connect to blockchain
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('Connected with wallet:', wallet.address);
  console.log('Settlement contract:', process.env.SETTLEMENT_CONTRACT);
  
  // Get contract instance
  const settlementABI = [
    'function updateAuthorizedSigner(address signer, bool authorized) external',
    'function authorizedSigners(address) view returns (bool)'
  ];
  
  const settlement = new ethers.Contract(
    process.env.SETTLEMENT_CONTRACT,
    settlementABI,
    wallet
  );
  
  // Authorize invoice signer
  console.log('\nAuthorizing invoice signer:', signingKeys.invoice.address);
  try {
    const tx1 = await settlement.updateAuthorizedSigner(
      signingKeys.invoice.address, 
      true
    );
    console.log('Tx hash:', tx1.hash);
    await tx1.wait();
    console.log('✅ Invoice signer authorized');
  } catch (error) {
    console.error('❌ Failed to authorize invoice signer:', error.message);
  }
  
  // Authorize payroll signer
  console.log('\nAuthorizing payroll signer:', signingKeys.payroll.address);
  try {
    const tx2 = await settlement.updateAuthorizedSigner(
      signingKeys.payroll.address, 
      true
    );
    console.log('Tx hash:', tx2.hash);
    await tx2.wait();
    console.log('✅ Payroll signer authorized');
  } catch (error) {
    console.error('❌ Failed to authorize payroll signer:', error.message);
  }
  
  // Verify authorization
  console.log('\nVerifying authorizations...');
  const invoiceAuth = await settlement.authorizedSigners(signingKeys.invoice.address);
  const payrollAuth = await settlement.authorizedSigners(signingKeys.payroll.address);
  
  console.log('Invoice signer authorized:', invoiceAuth);
  console.log('Payroll signer authorized:', payrollAuth);
  
  if (invoiceAuth && payrollAuth) {
    console.log('\n✅ All signers successfully authorized!');
  } else {
    console.log('\n⚠️  Some signers failed authorization');
  }
}

// Execute
setupSigners().catch(console.error);