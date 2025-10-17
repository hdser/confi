const fs = require('fs').promises;
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  try {
    const iexecIn = process.env.IEXEC_IN;
    const iexecOut = process.env.IEXEC_OUT;
    const taskId = process.env.IEXEC_TASK_ID;
    const signingKey = process.env.VOUCHER_SIGNING_KEY;

    if (!signingKey) {
      throw new Error("VOUCHER_SIGNING_KEY not found");
    }

    // Load payroll batch data
    const inputPath = path.join(iexecIn, 'protectedData.json');
    const batchData = JSON.parse(await fs.readFile(inputPath, 'utf8'));

    const wallet = new ethers.Wallet(signingKey);
    const vouchers = [];

    // Process each employee payment
    for (const employee of batchData.employees) {
      const voucherData = {
        type: 'PAYROLL_PAYMENT',
        batchId: batchData.metadata.batchId,
        recipientAddress: employee.walletAddress,
        tokenContract: employee.paymentInfo.tokenContract,
        amount: employee.compensation.netPay,
        taskId: taskId,
        timestamp: Date.now(),
        nonce: ethers.hexlify(ethers.randomBytes(16))
      };

      const message = JSON.stringify(voucherData, null, 0);
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await wallet.signMessage(ethers.getBytes(messageHash));

      vouchers.push({
        data: voucherData,
        signature: signature,
        signerAddress: wallet.address
      });
    }

    // Write results
    const result = {
      batchId: batchData.metadata.batchId,
      vouchers: vouchers,
      taskId: taskId,
      totalAmount: batchData.summary.totalNetPay,
      timestamp: Date.now()
    };

    const resultPath = path.join(iexecOut, 'result.json');
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

    const computedPath = path.join(iexecOut, 'computed.json');
    await fs.writeFile(computedPath, JSON.stringify({
      'deterministic-output-path': resultPath
    }));

    console.log(`Processed ${vouchers.length} payroll vouchers`);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();