import fs from 'node:fs/promises';
import { ethers } from 'ethers';
import { IExecDataProtectorDeserializer } from '@iexec/dataprotector-deserializer';

async function main() {
  const { IEXEC_OUT } = process.env;
  let computedJsonObj = {};

  try {
    console.log('🔐 Starting confidential payroll processor...');
    
    const taskId = process.env.IEXEC_TASK_ID || 'test-task-id';
    const { IEXEC_APP_DEVELOPER_SECRET } = process.env;

    if (!IEXEC_APP_DEVELOPER_SECRET) {
      throw new Error('IEXEC_APP_DEVELOPER_SECRET not found in environment');
    }

    console.log('Task ID:', taskId);

    // Initialize deserializer for protected data
    const deserializer = new IExecDataProtectorDeserializer();
    
    console.log('📥 Reading protected payroll data...');

    // Read batch metadata fields individually
    let batchId, payDate, totalEmployees, employeesData;
    
    try {
      batchId = await deserializer.getValue('batchId', 'string');
      console.log('✅ Batch ID loaded');
    } catch (e) {
      console.error('❌ Missing batchId:', e.message);
      throw new Error('Required field "batchId" not found in protected data');
    }

    try {
      payDate = await deserializer.getValue('payDate', 'string');
      console.log('✅ Pay date loaded');
    } catch (e) {
      console.log('⚠️ No pay date provided, using current timestamp');
      payDate = String(Date.now());
    }

    try {
      totalEmployees = await deserializer.getValue('totalEmployees', 'string');
      console.log('✅ Total employees:', totalEmployees);
    } catch (e) {
      console.log('⚠️ Total employees count not provided');
      totalEmployees = '0';
    }

    try {
      employeesData = await deserializer.getValue('employeesData', 'string');
      console.log('✅ Employee data loaded');
    } catch (e) {
      console.error('❌ Missing employeesData:', e.message);
      throw new Error('Required field "employeesData" not found in protected data');
    }

    // Parse the employees JSON string
    let employees;
    try {
      employees = JSON.parse(employeesData);
      console.log(`✅ Parsed ${employees.length} employees`);
    } catch (e) {
      console.error('❌ Failed to parse employee data:', e.message);
      throw new Error('Invalid employee data format');
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      throw new Error('Employee data must be a non-empty array');
    }

    // Parse app secret to get signing key
    let signingKey;
    try {
      const appSecrets = JSON.parse(IEXEC_APP_DEVELOPER_SECRET);
      signingKey = appSecrets.VOUCHER_SIGNING_KEY || appSecrets.signingKey || IEXEC_APP_DEVELOPER_SECRET;
    } catch {
      // If not JSON, use directly
      signingKey = IEXEC_APP_DEVELOPER_SECRET;
    }

    const wallet = new ethers.Wallet(signingKey);
    console.log('Signing with wallet:', wallet.address);
    
    // Process individual vouchers for each employee
    const vouchers = [];
    
    for (const employee of employees) {
      if (!employee.walletAddress) {
        throw new Error(`Employee ${employee.id || 'unknown'} missing wallet address`);
      }
      if (!employee.netPay) {
        throw new Error(`Employee ${employee.id || 'unknown'} missing net pay amount`);
      }
      
      const tokenContract = employee.tokenContract || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const timestamp = Date.now();
      const nonce = ethers.hexlify(ethers.randomBytes(16));
      
      // Create voucher data for this employee
      const voucherData = {
        recipient: employee.walletAddress,
        tokenContract: tokenContract,
        amount: employee.netPay,
        taskId: `${taskId}-${employee.id}`,
        timestamp: timestamp,
        nonce: nonce
      };
      
      // Create signature
      const types = ['address', 'address', 'uint256', 'string', 'uint256', 'string'];
      const values = [
        voucherData.recipient,
        voucherData.tokenContract,
        voucherData.amount,
        voucherData.taskId,
        voucherData.timestamp,
        voucherData.nonce
      ];
      
      const messageHash = ethers.solidityPackedKeccak256(types, values);
      const signature = await wallet.signMessage(ethers.getBytes(messageHash));
      
      vouchers.push({
        employeeId: employee.id,
        employeeName: employee.name || `Employee ${employee.id}`,
        data: voucherData,
        signature: signature,
        signerAddress: wallet.address
      });
    }

    console.log(`✅ Generated ${vouchers.length} payment vouchers`);

    // Calculate totals
    const totalAmount = vouchers.reduce((sum, v) => 
      sum + BigInt(v.data.amount), 0n
    );

    // Create the result
    const result = {
      type: 'PAYROLL_BATCH',
      batchId: batchId,
      vouchers: vouchers,
      summary: {
        totalEmployees: vouchers.length,
        totalAmount: totalAmount.toString(),
        totalAmountFormatted: ethers.formatUnits(totalAmount, 6) + ' USDC',
        payDate: payDate,
        processedAt: new Date().toISOString(),
        signerAddress: wallet.address
      }
    };

    // Write main result
    const resultPath = `${IEXEC_OUT}/result.json`;
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
    console.log('✅ Result written');

    console.log(`\n🎉 Payroll batch processed successfully!`);
    console.log(`📊 Processed ${vouchers.length} payments`);
    console.log(`💰 Total: ${ethers.formatUnits(totalAmount, 6)} USDC`);

    // Build the computed.json object
    computedJsonObj = {
      'deterministic-output-path': resultPath
    };

  } catch (error) {
    console.error('❌ ERROR during payroll processing:', error.message);
    console.error('Stack trace:', error.stack);

    // Build the computed.json object with error message
    computedJsonObj = {
      'deterministic-output-path': IEXEC_OUT,
      'error-message': `Payroll processing failed: ${error.message}`
    };
  } finally {
    // Save the computed.json file (REQUIRED)
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj)
    );
  }
}

main();