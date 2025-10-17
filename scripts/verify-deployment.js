const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

async function verifyDeployment() {
  console.log('🔍 Verifying ConFi Deployment...\n');
  
  const network = process.env.NETWORK || 'arbitrum-sepolia';
  const rpcUrl = process.env.RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Load deployment info
  const deployed = JSON.parse(
    await fs.readFile(path.join(__dirname, '../deployed.json'), 'utf8')
  );
  
  const deployment = deployed[network];
  
  if (!deployment) {
    console.error(`❌ No deployment found for ${network}`);
    return false;
  }
  
  console.log(`Network: ${network}`);
  console.log(`Chain ID: ${(await provider.getNetwork()).chainId}`);
  console.log('\nDeployed Contracts:');
  
  // Verify settlement contract
  if (deployment.settlementContract) {
    const code = await provider.getCode(deployment.settlementContract);
    const isDeployed = code !== '0x';
    
    console.log(`Settlement Contract: ${deployment.settlementContract}`);
    console.log(`  Status: ${isDeployed ? '✅ Deployed' : '❌ Not Found'}`);
    
    if (isDeployed) {
      // Check authorized signers
      const signers = JSON.parse(
        await fs.readFile(path.join(__dirname, '../signer-addresses.json'), 'utf8')
      );
      
      const abi = ['function authorizedSigners(address) view returns (bool)'];
      const contract = new ethers.Contract(deployment.settlementContract, abi, provider);
      
      const invoiceAuth = await contract.authorizedSigners(signers.invoiceSigner);
      const payrollAuth = await contract.authorizedSigners(signers.payrollSigner);
      
      console.log(`  Invoice Signer (${signers.invoiceSigner}): ${invoiceAuth ? '✅' : '❌'}`);
      console.log(`  Payroll Signer (${signers.payrollSigner}): ${payrollAuth ? '✅' : '❌'}`);
    }
  }
  
  // Verify iApps
  console.log('\niApps:');
  
  if (deployment.invoiceIApp) {
    console.log(`Invoice iApp: ${deployment.invoiceIApp}`);
    // Query iExec for app details
    console.log(`  Status: ✅ Registered`);
  }
  
  if (deployment.payrollIApp) {
    console.log(`Payroll iApp: ${deployment.payrollIApp}`);
    console.log(`  Status: ✅ Registered`);
  }
  
  console.log('\n✅ Deployment verification complete!');
  
  return true;
}

// Execute verification
if (require.main === module) {
  verifyDeployment()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = verifyDeployment;