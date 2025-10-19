import fs from 'node:fs/promises';
import { ethers } from 'ethers';
import { IExecDataProtectorDeserializer } from '@iexec/dataprotector-deserializer';

async function main() {
  const { IEXEC_OUT } = process.env;
  let computedJsonObj = {};

  try {
    console.log('🔐 Starting confidential invoice processor...');
    
    // Get environment variables
    const taskId = process.env.IEXEC_TASK_ID || 'test-task-id';
    const { IEXEC_APP_DEVELOPER_SECRET } = process.env;
    
    if (!IEXEC_APP_DEVELOPER_SECRET) {
      throw new Error('IEXEC_APP_DEVELOPER_SECRET not found in environment');
    }

    console.log('Task ID:', taskId);

    // Initialize deserializer for protected data
    const deserializer = new IExecDataProtectorDeserializer();
    
    // Read protected data fields individually using the correct pattern
    console.log('📥 Reading protected invoice data...');
    
    // Read each field with proper error handling
    let recipientAddress, tokenContract, amount, invoiceNumber, memo, dueDate, timestamp, nonce;
    
    try {
      recipientAddress = await deserializer.getValue('recipientAddress', 'string');
      console.log('✅ Recipient address loaded');
    } catch (e) {
      console.error('❌ Missing recipientAddress:', e.message);
      throw new Error('Required field "recipientAddress" not found in protected data');
    }

    try {
      amount = await deserializer.getValue('amount', 'string');
      console.log('✅ Amount loaded');
    } catch (e) {
      console.error('❌ Missing amount:', e.message);
      throw new Error('Required field "amount" not found in protected data');
    }

    try {
      invoiceNumber = await deserializer.getValue('invoiceNumber', 'string');
      console.log('✅ Invoice number:', invoiceNumber);
    } catch (e) {
      console.log('⚠️ No invoice number provided, generating default');
      invoiceNumber = `INV-${Date.now()}`;
    }

    try {
      tokenContract = await deserializer.getValue('tokenContract', 'string');
    } catch (e) {
      console.log('⚠️ No token contract specified, using default USDC');
      tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    }

    try {
      memo = await deserializer.getValue('memo', 'string');
    } catch (e) {
      console.log('⚠️ No memo provided');
      memo = 'Payment invoice';
    }

    try {
      dueDate = await deserializer.getValue('dueDate', 'string');
    } catch (e) {
      console.log('⚠️ No due date provided');
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      timestamp = await deserializer.getValue('timestamp', 'string');
    } catch (e) {
      timestamp = String(Date.now());
    }

    try {
      nonce = await deserializer.getValue('nonce', 'string');
    } catch (e) {
      nonce = ethers.hexlify(ethers.randomBytes(16));
    }

    console.log('✅ All protected data loaded successfully');

    // Parse app secret to get signing key
    let signingKey;
    try {
      const appSecrets = JSON.parse(IEXEC_APP_DEVELOPER_SECRET);
      signingKey = appSecrets.VOUCHER_SIGNING_KEY || appSecrets.signingKey || IEXEC_APP_DEVELOPER_SECRET;
    } catch {
      // If not JSON, use directly
      signingKey = IEXEC_APP_DEVELOPER_SECRET;
    }

    // Construct the voucher data matching the contract's PaymentVoucher struct
    const voucherData = {
      recipient: recipientAddress,
      tokenContract: tokenContract,
      amount: amount,
      taskId: taskId,
      timestamp: parseInt(timestamp),
      nonce: nonce
    };

    console.log('🔏 Creating cryptographic signature...');

    // Create the hash exactly as the contract expects
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
    
    // Sign the hash
    const wallet = new ethers.Wallet(signingKey);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    console.log('✅ Voucher signed by:', wallet.address);

    // Create the complete voucher package
    const voucher = {
      data: voucherData,
      signature: signature,
      signerAddress: wallet.address,
      metadata: {
        invoiceNumber: invoiceNumber,
        memo: memo,
        dueDate: dueDate,
        processedAt: new Date().toISOString()
      }
    };

    // Write the result
    const resultPath = `${IEXEC_OUT}/result.json`;
    await fs.writeFile(resultPath, JSON.stringify(voucher, null, 2));

    console.log('✅ Invoice processed successfully');
    console.log('📄 Invoice:', invoiceNumber);
    console.log('💰 Amount:', ethers.formatUnits(amount, 6), 'USDC');
    console.log('📁 Output: result.json');

    // Build the computed.json object
    computedJsonObj = {
      'deterministic-output-path': resultPath
    };

  } catch (error) {
    console.error('❌ ERROR during invoice processing:', error.message);
    console.error('Stack trace:', error.stack);

    // Build the computed.json object with error message
    computedJsonObj = {
      'deterministic-output-path': IEXEC_OUT,
      'error-message': `Invoice processing failed: ${error.message}`
    };
  } finally {
    // Save the computed.json file (REQUIRED)
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj)
    );
  }
}

// Execute the main function
main();