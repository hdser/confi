const fs = require('fs').promises;
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  try {
    const iexecIn = process.env.IEXEC_IN;
    const iexecOut = process.env.IEXEC_OUT;
    const taskId = process.env.IEXEC_TASK_ID;
    const signingKey = process.env.VOUCHER_SIGNING_KEY || process.env.IEXEC_APP_DEVELOPER_SECRET;

    if (!signingKey) {
      throw new Error("VOUCHER_SIGNING_KEY not found");
    }

    console.log("Starting payroll batch processor...");
    console.log("Task ID:", taskId);

    // Load payroll batch data
    const inputPath = path.join(iexecIn, 'protectedData.json');
    const batchData = JSON.parse(await fs.readFile(inputPath, 'utf8'));

    console.log(`Processing payroll batch: ${batchData.metadata.batchId}`);
    console.log(`Number of employees: ${batchData.employees.length}`);

    const wallet = new ethers.Wallet(signingKey);
    
    // Prepare batch payment data
    const recipients = [];
    const amounts = [];
    let totalAmount = ethers.BigNumber.from(0);
    
    // Extract all recipients and amounts
    for (const employee of batchData.employees) {
      recipients.push(employee.walletAddress);
      amounts.push(employee.compensation.netPay);
      totalAmount = totalAmount.add(ethers.BigNumber.from(employee.compensation.netPay));
    }

    // Assume all employees use the same token (typically the case)
    const tokenContract = batchData.employees[0].paymentInfo.tokenContract || 
                          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC default

    const timestamp = Date.now();
    const nonce = ethers.hexlify(ethers.randomBytes(16));

    // Create batch voucher data
    const batchVoucherData = {
      tokenContract: tokenContract,
      recipients: recipients,
      amounts: amounts,
      taskId: taskId,
      timestamp: timestamp,
      nonce: nonce,
      batchId: batchData.metadata.batchId,
      totalAmount: totalAmount.toString()
    };

    // CRITICAL FIX: Sign the batch using proper hashing
    // Hash arrays by encoding them first
    const recipientsHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['address[]'], [recipients])
    );
    const amountsHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]'], [amounts])
    );

    // Create the message hash for batch payment
    const types = ['address', 'bytes32', 'bytes32', 'string', 'uint256', 'string'];
    const values = [
      tokenContract,
      recipientsHash,
      amountsHash,
      taskId,
      timestamp,
      nonce
    ];
    
    const messageHash = ethers.solidityPackedKeccak256(types, values);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    console.log("Batch voucher signed by:", wallet.address);
    console.log("Total amount to distribute:", ethers.formatUnits(totalAmount, 6), "USDC");

    // Create the result with batch voucher
    const result = {
      type: 'BATCH_PAYMENT',
      batchId: batchData.metadata.batchId,
      data: batchVoucherData,
      signature: signature,
      signerAddress: wallet.address,
      summary: {
        totalEmployees: recipients.length,
        totalAmount: totalAmount.toString(),
        tokenContract: tokenContract,
        payDate: batchData.metadata.payDate,
        processedAt: new Date().toISOString()
      }
    };

    // Write main result
    const resultPath = path.join(iexecOut, 'result.json');
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

    // Generate accounting export (ADP/QuickBooks format)
    const accountingRecords = batchData.employees.map((emp, idx) => ({
      employeeId: emp.id,
      name: emp.personalInfo?.name || `Employee ${idx + 1}`,
      department: emp.personalInfo?.department || 'N/A',
      walletAddress: emp.walletAddress,
      hoursWorked: emp.compensation.hoursWorked || 0,
      grossPay: emp.compensation.earnings?.regular || emp.compensation.netPay,
      netPay: emp.compensation.netPay,
      paymentMethod: 'CRYPTO',
      tokenContract: tokenContract,
      currency: 'USDC',
      payDate: new Date(batchData.metadata.payDate).toISOString().split('T')[0],
      batchId: batchData.metadata.batchId
    }));

    // Write CSV export for accounting software
    const csvHeader = 'EmployeeID,Name,Department,WalletAddress,HoursWorked,GrossPay,NetPay,PaymentMethod,Currency,PayDate,BatchID\n';
    const csvRows = accountingRecords.map(rec => 
      `${rec.employeeId},${rec.name},${rec.department},${rec.walletAddress},${rec.hoursWorked},` +
      `${ethers.formatUnits(rec.grossPay, 6)},${ethers.formatUnits(rec.netPay, 6)},` +
      `${rec.paymentMethod},${rec.currency},${rec.payDate},${rec.batchId}`
    ).join('\n');

    const csvPath = path.join(iexecOut, 'payroll_export.csv');
    await fs.writeFile(csvPath, csvHeader + csvRows);

    // Also write JSON format for modern systems
    const jsonExportPath = path.join(iexecOut, 'payroll_export.json');
    await fs.writeFile(jsonExportPath, JSON.stringify({
      batchId: batchData.metadata.batchId,
      payDate: batchData.metadata.payDate,
      records: accountingRecords,
      summary: {
        totalEmployees: recipients.length,
        totalNetPay: totalAmount.toString(),
        currency: 'USDC',
        processedBy: wallet.address,
        processedAt: new Date().toISOString()
      }
    }, null, 2));

    // Create computed.json for iExec
    const computedPath = path.join(iexecOut, 'computed.json');
    await fs.writeFile(computedPath, JSON.stringify({
      'deterministic-output-path': resultPath
    }));

    console.log(`✅ Payroll batch processed successfully`);
    console.log(`Processed ${recipients.length} payments totaling ${ethers.formatUnits(totalAmount, 6)} USDC`);
    console.log("Output files: result.json, payroll_export.csv, payroll_export.json");

  } catch (error) {
    console.error("❌ Error during payroll processing:", error);
    process.exit(1);
  }
}

main();