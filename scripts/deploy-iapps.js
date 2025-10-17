// scripts/deploy-iapps.js
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function deployIApps() {
  console.log('🚀 Deploying ConFi iApps to iExec...\n');
  
  // Validate environment
  const dockerUsername = process.env.DOCKER_USERNAME;
  const network = process.env.NETWORK || 'arbitrum-sepolia';
  
  if (!dockerUsername) {
    throw new Error('DOCKER_USERNAME not set in .env file');
  }
  
  try {
    // Step 1: Check wallet configuration
    console.log('📝 Checking wallet configuration...');
    try {
      await executeCommand('iexec wallet show --keystoredir ./wallets');
    } catch (error) {
      console.log('⚠️  No wallet found, creating one...');
      if (process.env.PRIVATE_KEY) {
        await executeCommand(`iexec wallet import ${process.env.PRIVATE_KEY} --keystoredir ./wallets`);
      } else {
        throw new Error('No wallet found and PRIVATE_KEY not set in .env');
      }
    }
    
    // Step 2: Check Docker login
    console.log('\n🐳 Checking Docker login...');
    try {
      await executeCommand('docker info');
    } catch (error) {
      throw new Error('Docker is not running. Please start Docker Desktop.');
    }
    
    // Step 3: Build Docker images
    console.log('\n🔨 Building Docker images...');
    
    // Build invoice processor
    console.log('Building invoice processor image...');
    await executeCommand(
      `docker build -t ${dockerUsername}/confi-invoice:latest -f src/iapp/Dockerfile.invoice src/iapp/`
    );
    
    // Build payroll processor
    console.log('Building payroll processor image...');
    await executeCommand(
      `docker build -t ${dockerUsername}/confi-payroll:latest -f src/iapp/Dockerfile.payroll src/iapp/`
    );
    
    // Step 4: Push images to DockerHub
    console.log('\n📤 Pushing images to DockerHub...');
    
    // Check if logged in to DockerHub
    try {
      await executeCommand(`docker push ${dockerUsername}/confi-invoice:latest`);
    } catch (error) {
      console.log('⚠️  Not logged in to DockerHub, attempting login...');
      if (process.env.DOCKER_PASSWORD) {
        await executeCommand(
          `echo ${process.env.DOCKER_PASSWORD} | docker login -u ${dockerUsername} --password-stdin`
        );
        await executeCommand(`docker push ${dockerUsername}/confi-invoice:latest`);
      } else {
        throw new Error('Docker push failed. Please run: docker login');
      }
    }
    
    await executeCommand(`docker push ${dockerUsername}/confi-payroll:latest`);
    console.log('✅ Images pushed successfully');
    
    // Step 5: Deploy Invoice iApp
    console.log('\n📦 Deploying Invoice iApp...');
    console.log(`Image: ${dockerUsername}/confi-invoice:latest`);
    console.log(`Network: ${network}`);
    
    let invoiceAddress;
    try {
      // Use iapp CLI if available
      const invoiceResult = await executeCommand(
        `cd src/iapp && iapp deploy ${dockerUsername}/confi-invoice:latest --chain ${network} --keystoredir ../../wallets`
      );
      
      // Parse the deployed address from output
      const addressMatch = invoiceResult.match(/deployed at address[:\s]+(0x[a-fA-F0-9]{40})/i) ||
                          invoiceResult.match(/(0x[a-fA-F0-9]{40})/);
      
      if (addressMatch) {
        invoiceAddress = addressMatch[1] || addressMatch[0];
        console.log(`✅ Invoice iApp deployed at: ${invoiceAddress}`);
      } else {
        throw new Error('Could not parse invoice iApp address from deployment output');
      }
    } catch (error) {
      // Fallback to iexec SDK deployment
      console.log('Falling back to iexec SDK deployment...');
      const deployResult = await deployWithIExecSDK(
        'confi-invoice',
        `${dockerUsername}/confi-invoice:latest`,
        network
      );
      invoiceAddress = deployResult.address;
    }
    
    // Step 6: Deploy Payroll iApp
    console.log('\n📦 Deploying Payroll iApp...');
    console.log(`Image: ${dockerUsername}/confi-payroll:latest`);
    
    let payrollAddress;
    try {
      const payrollResult = await executeCommand(
        `cd src/iapp && iapp deploy ${dockerUsername}/confi-payroll:latest --chain ${network} --keystoredir ../../wallets`
      );
      
      const addressMatch = payrollResult.match(/deployed at address[:\s]+(0x[a-fA-F0-9]{40})/i) ||
                          payrollResult.match(/(0x[a-fA-F0-9]{40})/);
      
      if (addressMatch) {
        payrollAddress = addressMatch[1] || addressMatch[0];
        console.log(`✅ Payroll iApp deployed at: ${payrollAddress}`);
      } else {
        throw new Error('Could not parse payroll iApp address from deployment output');
      }
    } catch (error) {
      console.log('Falling back to iexec SDK deployment...');
      const deployResult = await deployWithIExecSDK(
        'confi-payroll',
        `${dockerUsername}/confi-payroll:latest`,
        network
      );
      payrollAddress = deployResult.address;
    }
    
    // Step 7: Update configuration files
    console.log('\n💾 Updating configuration files...');
    
    // Update deployed.json
    const deployedPath = path.join(__dirname, '../deployed.json');
    let deployed = {};
    try {
      deployed = JSON.parse(await fs.readFile(deployedPath, 'utf8'));
    } catch (error) {
      console.log('Creating new deployed.json...');
    }
    
    deployed[network] = {
      ...deployed[network],
      invoiceIApp: invoiceAddress,
      payrollIApp: payrollAddress,
      deployedAt: new Date().toISOString(),
      dockerImages: {
        invoice: `${dockerUsername}/confi-invoice:latest`,
        payroll: `${dockerUsername}/confi-payroll:latest`
      }
    };
    
    await fs.writeFile(deployedPath, JSON.stringify(deployed, null, 2));
    
    // Update .env file
    await updateEnvFile({
      INVOICE_IAPP_ADDRESS: invoiceAddress,
      PAYROLL_IAPP_ADDRESS: payrollAddress
    });
    
    // Step 8: Push app secrets (signing keys)
    console.log('\n🔐 Setting up app secrets...');
    try {
      await setupAppSecrets(invoiceAddress, payrollAddress, network);
    } catch (error) {
      console.log('⚠️  Warning: Could not set up app secrets automatically');
      console.log('Please run: npm run setup:signers');
    }
    
    // Step 9: Display summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ DEPLOYMENT SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('\n📋 Deployment Summary:');
    console.log(`  Network: ${network}`);
    console.log(`  Invoice iApp: ${invoiceAddress}`);
    console.log(`  Payroll iApp: ${payrollAddress}`);
    console.log(`  Docker Images:`);
    console.log(`    - ${dockerUsername}/confi-invoice:latest`);
    console.log(`    - ${dockerUsername}/confi-payroll:latest`);
    console.log('\n📝 Next Steps:');
    console.log('  1. Run: npm run setup:signers (if not done automatically)');
    console.log('  2. Run: npm run publish:orders');
    console.log('  3. Run: npm run verify');
    console.log('  4. Start frontend: npm run dev');
    console.log('\n🔗 View on iExec Explorer:');
    console.log(`  https://explorer.iex.ec/${network}/app/${invoiceAddress}`);
    console.log(`  https://explorer.iex.ec/${network}/app/${payrollAddress}`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('  1. Ensure Docker is running');
    console.error('  2. Check you are logged in to DockerHub: docker login');
    console.error('  3. Verify wallet has funds (ETH and RLC)');
    console.error('  4. Check network connectivity');
    console.error('\nFor detailed logs, check: ./deployment.log');
    process.exit(1);
  }
}

// Fallback deployment using iExec SDK
async function deployWithIExecSDK(name, dockerImage, network) {
  console.log(`Deploying ${name} using iExec SDK...`);
  
  // Create app configuration
  const appConfig = {
    owner: process.env.WALLET_ADDRESS,
    name: `ConFi ${name}`,
    type: 'DOCKER',
    multiaddr: dockerImage,
    checksum: '0x0000000000000000000000000000000000000000000000000000000000000000',
    mrenclave: ''
  };
  
  // Write temporary iexec.json
  const tempConfig = {
    app: appConfig,
    order: {
      apporder: {
        app: '0x0000000000000000000000000000000000000000',
        appprice: '0',
        volume: '1000000',
        tag: '0x0000000000000000000000000000000000000000000000000000000000000001',
        datasetrestrict: '0x0000000000000000000000000000000000000000',
        workerpoolrestrict: '0x0000000000000000000000000000000000000000',
        requesterrestrict: '0x0000000000000000000000000000000000000000'
      }
    }
  };
  
  await fs.writeFile('temp-iexec.json', JSON.stringify(tempConfig, null, 2));
  
  try {
    // Deploy app
    const result = await executeCommand(
      `iexec app deploy --chain ${network} --keystoredir ./wallets --config temp-iexec.json`
    );
    
    // Parse address
    const match = result.match(/(0x[a-fA-F0-9]{40})/);
    if (!match) {
      throw new Error('Could not parse deployed address');
    }
    
    return { address: match[0] };
  } finally {
    // Clean up temp file
    try {
      await fs.unlink('temp-iexec.json');
    } catch {}
  }
}

// Setup app secrets (signing keys)
async function setupAppSecrets(invoiceAddress, payrollAddress, network) {
  const { ethers } = require('ethers');
  
  // Generate signing wallets
  const invoiceWallet = ethers.Wallet.createRandom();
  const payrollWallet = ethers.Wallet.createRandom();
  
  console.log('Generated signing wallets:');
  console.log(`  Invoice signer: ${invoiceWallet.address}`);
  console.log(`  Payroll signer: ${payrollWallet.address}`);
  
  // Push secrets to SMS
  console.log('Pushing secrets to iExec SMS...');
  
  await executeCommand(
    `iexec app push-secret ${invoiceAddress} --secret-name VOUCHER_SIGNING_KEY --secret-value ${invoiceWallet.privateKey} --chain ${network} --keystoredir ./wallets`
  );
  
  await executeCommand(
    `iexec app push-secret ${payrollAddress} --secret-name VOUCHER_SIGNING_KEY --secret-value ${payrollWallet.privateKey} --chain ${network} --keystoredir ./wallets`
  );
  
  // Save signer addresses
  const signersPath = path.join(__dirname, '../signer-addresses.json');
  await fs.writeFile(signersPath, JSON.stringify({
    network,
    invoiceSigner: invoiceWallet.address,
    payrollSigner: payrollWallet.address,
    setupAt: new Date().toISOString()
  }, null, 2));
  
  console.log('✅ Secrets configured successfully');
}

// Update .env file with new values
async function updateEnvFile(updates) {
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  
  try {
    envContent = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    console.log('Creating new .env file...');
  }
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*`, 'gm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  
  await fs.writeFile(envPath, envContent.trim() + '\n');
}

// Execute shell command with logging
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`  $ ${command}`);
    
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Log to file
      const logContent = `
Command: ${command}
Time: ${new Date().toISOString()}
STDOUT: ${stdout}
STDERR: ${stderr}
ERROR: ${error ? error.message : 'none'}
${'='.repeat(60)}
`;
      fs.appendFile('deployment.log', logContent).catch(() => {});
      
      if (error) {
        console.error(`  ❌ Error: ${stderr || error.message}`);
        reject(new Error(stderr || error.message));
      } else {
        if (stdout) console.log(`  ${stdout.trim()}`);
        resolve(stdout);
      }
    });
  });
}

// Execute deployment if run directly
if (require.main === module) {
  deployIApps()
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = deployIApps;