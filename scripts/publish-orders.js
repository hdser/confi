const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function publishOrders() {
  console.log('📤 Publishing iExec Orders...\n');
  
  const network = process.env.NETWORK || 'arbitrum-sepolia';
  
  // Load deployed addresses
  const deployed = JSON.parse(
    await fs.readFile(path.join(__dirname, '../deployed.json'), 'utf8')
  );
  
  const invoiceIApp = deployed[network].invoiceIApp;
  const payrollIApp = deployed[network].payrollIApp;
  
  if (!invoiceIApp || !payrollIApp) {
    throw new Error('iApps not deployed');
  }
  
  // Initialize app orders
  console.log('Initializing app orders...');
  await executeCommand(`iexec order init --app --chain ${network}`);
  
  // Update iexec.json with app addresses
  const iexecConfig = JSON.parse(
    await fs.readFile(path.join(__dirname, '../iexec.json'), 'utf8')
  );
  
  // Sign and publish invoice app order
  console.log('\nPublishing invoice app order...');
  iexecConfig.order.apporder.app = invoiceIApp;
  iexecConfig.order.apporder.appprice = '0';
  iexecConfig.order.apporder.volume = '1000000';
  iexecConfig.order.apporder.tag = '0x0000000000000000000000000000000000000000000000000000000000000001'; // TEE tag
  
  await fs.writeFile(
    path.join(__dirname, '../iexec.json'),
    JSON.stringify(iexecConfig, null, 2)
  );
  
  await executeCommand(`iexec order sign --app --chain ${network}`);
  await executeCommand(`iexec order publish --app --chain ${network}`);
  
  console.log(`✅ Invoice app order published`);
  
  // Sign and publish payroll app order
  console.log('\nPublishing payroll app order...');
  iexecConfig.order.apporder.app = payrollIApp;
  
  await fs.writeFile(
    path.join(__dirname, '../iexec.json'),
    JSON.stringify(iexecConfig, null, 2)
  );
  
  await executeCommand(`iexec order sign --app --chain ${network}`);
  await executeCommand(`iexec order publish --app --chain ${network}`);
  
  console.log(`✅ Payroll app order published`);
  
  console.log('\n✅ All orders published successfully!');
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

// Execute
if (require.main === module) {
  publishOrders()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = publishOrders;