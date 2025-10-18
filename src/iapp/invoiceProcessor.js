const fs = require('fs').promises;
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  try {
    // Access iExec environment variables
    const iexecIn = process.env.IEXEC_IN;
    const iexecOut = process.env.IEXEC_OUT;
    const taskId = process.env.IEXEC_TASK_ID;
    
    // Load the signing key from Secret Management Service
    const voucherSigningKey = process.env.VOUCHER_SIGNING_KEY || process.env.IEXEC_APP_DEVELOPER_SECRET;
    if (!voucherSigningKey) {
      throw new Error("VOUCHER_SIGNING_KEY not found in environment");
    }

    console.log("Starting invoice processor...");
    console.log("Task ID:", taskId);

    // Load the protected payment request data
    const inputFilePath = path.join(iexecIn, 'protectedData.json');
    const paymentRequestData = JSON.parse(
      await fs.readFile(inputFilePath, 'utf8')
    );

    console.log("Processing invoice for recipient:", paymentRequestData.recipientAddress);

    // Ensure we have all required fields
    const timestamp = paymentRequestData.timestamp || Date.now();
    const nonce = paymentRequestData.nonce || ethers.hexlify(ethers.randomBytes(16));

    // Construct the voucher data matching the contract's PaymentVoucher struct
    const voucherData = {
      recipient: paymentRequestData.recipientAddress,
      tokenContract: paymentRequestData.tokenContract || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Default USDC
      amount: paymentRequestData.amount,
      taskId: taskId,
      timestamp: timestamp,
      nonce: nonce
    };

    // CRITICAL FIX: Use solidityPackedKeccak256 to match contract's hashing
    const types = ['address', 'address', 'uint256', 'string', 'uint256', 'string'];
    const values = [
      voucherData.recipient,
      voucherData.tokenContract,
      voucherData.amount,
      voucherData.taskId,
      voucherData.timestamp,
      voucherData.nonce
    ];
    
    // Create the hash exactly as the contract expects
    const messageHash = ethers.solidityPackedKeccak256(types, values);
    
    // Sign the hash
    const wallet = new ethers.Wallet(voucherSigningKey);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    console.log("Voucher signed by:", wallet.address);

    // Create the complete voucher package
    const voucher = {
      data: voucherData,
      signature: signature,
      signerAddress: wallet.address,
      metadata: {
        invoiceNumber: paymentRequestData.invoiceNumber,
        memo: paymentRequestData.memo,
        dueDate: paymentRequestData.dueDate,
        processedAt: new Date().toISOString()
      }
    };

    // Write the result
    const resultPath = path.join(iexecOut, 'result.json');
    await fs.writeFile(resultPath, JSON.stringify(voucher, null, 2));

    // Generate accounting export (QuickBooks format)
    const accountingExport = {
      type: 'INVOICE',
      date: new Date().toISOString(),
      invoiceNumber: paymentRequestData.invoiceNumber || `INV-${Date.now()}`,
      recipient: voucherData.recipient,
      amount: ethers.formatUnits(voucherData.amount, 6), // Assuming USDC with 6 decimals
      currency: 'USDC',
      tokenContract: voucherData.tokenContract,
      taskId: taskId,
      status: 'PROCESSED'
    };

    const exportPath = path.join(iexecOut, 'accounting_export.json');
    await fs.writeFile(exportPath, JSON.stringify(accountingExport, null, 2));

    // Create computed.json for iExec
    const computedPath = path.join(iexecOut, 'computed.json');
    await fs.writeFile(computedPath, JSON.stringify({
      'deterministic-output-path': resultPath
    }));

    console.log("✅ Invoice processed successfully");
    console.log("Voucher amount:", voucherData.amount);
    console.log("Output files created: result.json, accounting_export.json");

  } catch (error) {
    console.error("❌ Error during invoice processing:", error);
    process.exit(1);
  }
}

// Execute the main function
main();