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
    const voucherSigningKey = process.env.VOUCHER_SIGNING_KEY;
    if (!voucherSigningKey) {
      throw new Error("VOUCHER_SIGNING_KEY not found in environment");
    }

    // Load the protected payment request data
    const inputFilePath = path.join(iexecIn, 'protectedData.json');
    const paymentRequestData = JSON.parse(
      await fs.readFile(inputFilePath, 'utf8')
    );

    // Construct claim details for the voucher
    const claimDetails = {
      recipientAddress: paymentRequestData.recipientAddress,
      tokenContract: paymentRequestData.tokenContract,
      amount: paymentRequestData.amount,
      taskId: taskId
    };

    // Sign the claim details
    const wallet = new ethers.Wallet(voucherSigningKey);
    const message = JSON.stringify(claimDetails, null, 0);
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Create the payment voucher
    const voucher = {
      claimDetails: claimDetails,
      signature: signature
    };

    // Write the result
    const resultPath = path.join(iexecOut, 'result.json');
    await fs.writeFile(resultPath, JSON.stringify(voucher, null, 2));

    // Create computed.json for iExec
    const computedPath = path.join(iexecOut, 'computed.json');
    await fs.writeFile(computedPath, JSON.stringify({
      'deterministic-output-path': resultPath
    }));

    console.log("Confidential payment voucher generated successfully.");

  } catch (error) {
    console.error("Error during iApp execution:", error);
    process.exit(1);
  }
}

// Execute the main function
main();