#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

console.log('🔑 Generating ConFi Signing Keys...\n');

// Generate wallets
const invoiceWallet = ethers.Wallet.createRandom();
const payrollWallet = ethers.Wallet.createRandom();

// Create output
const keysOutput = {
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

// Save to JSON
const keysPath = path.join(__dirname, '../signing-keys.json');
fs.writeFileSync(keysPath, JSON.stringify(keysOutput, null, 2));

// Create .env format
const envContent = `# Generated Signing Keys - ${new Date().toISOString()}
# NEVER COMMIT THESE TO GIT

INVOICE_SIGNING_KEY=${invoiceWallet.privateKey}
INVOICE_SIGNER_ADDRESS=${invoiceWallet.address}
PAYROLL_SIGNING_KEY=${payrollWallet.privateKey}
PAYROLL_SIGNER_ADDRESS=${payrollWallet.address}
`;

const envPath = path.join(__dirname, '../signing-keys.env');
fs.writeFileSync(envPath, envContent);

console.log('✅ Keys generated successfully!\n');
console.log('Invoice Signer Address:', invoiceWallet.address);
console.log('Payroll Signer Address:', payrollWallet.address);
console.log('\nSaved to:');
console.log('  - signing-keys.json');
console.log('  - signing-keys.env');
console.log('\n⚠️  Keep these files secure and NEVER commit to git!');