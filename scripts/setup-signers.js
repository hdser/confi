const { ethers } = require('ethers');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function setupSigners() {
  console.log('🔐 Setting up ConFi Signers...\n');
  
  const network = process.env.NETWORK || 'arbitrum-sepolia';
  const privateKey = process.env.PRIVATE_KEY;
  
  // Generate signing keys for iApps
  const invoiceWallet = ethers.Wallet.createRandom();
  const payrollWallet = ethers.Wallet.createRandom();
  
  console.log('Generated Invoice Signer:', invoiceWallet.address);
  console.log('Generated Payroll Signer:', payrollWallet.address);
  
  // Push secrets to iExec SMS
  console.log('\nPushing secrets to iExec SMS...');
  
  await executeCommand(
    `iexec app push-secret --secret-name INVOICE_SIGNING_KEY --secret-value ${invoiceWallet.privateKey} --chain ${network}`
  );
  
  await executeCommand(
    `iexec app push-secret --secret-name PAYROLL_SIGNING_KEY --secret-value ${payrollWallet.privateKey} --chain ${network}`
  );
  
  // Update settlement contract with authorized signers
  console.log('\nAuthorizing signers in settlement contract...');
  
  const deployed = JSON.parse(
    await fs.readFile(path.join(__dirname, '../deployed.json'), 'utf8')
  );
  
  const settlementAddress = deployed[network].settlementContract;
  
  if (!settlementAddress) {
    throw new Error('Settlement contract not deployed');
  }
  
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const settlementABI = [
    'function updateAuthorizedSigner(address signer, bool authorized) external'
  ];
  
  const settlement = new ethers.Contract(settlementAddress, settlementABI, wallet);
  
  // Authorize invoice signer
  let tx = await settlement.updateAuthorizedSigner(invoiceWallet.address, true);
  await tx.wait();
  console.log(`✅ Authorized invoice signer: ${invoiceWallet.address}`);
  
  // Authorize payroll signer
  tx = await settlement.updateAuthorizedSigner(payrollWallet.address, true);
  await tx.wait();
  console.log(`✅ Authorized payroll signer: ${payrollWallet.address}`);
  
  // Save signer addresses
  const signersPath = path.join(__dirname, '../signer-addresses.json');
  await fs.writeFile(signersPath, JSON.stringify({
    network,
    invoiceSigner: invoiceWallet.address,
    payrollSigner: payrollWallet.address,
    setupAt: new Date().toISOString()
  }, null, 2));
  
  console.log('\n✅ Signer setup complete!');
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${stderr}`);
        reject(error);
      } else {
        console.log(stdout);
        resolve(stdout);
      }
    });
  });
}

// Execute setup
if (require.main === module) {
  setupSigners()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = setupSigners;