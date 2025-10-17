import { IExecDataProtector } from '@iexec/dataprotector';
import { ethers } from 'ethers';

class ConFiClient {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.dataProtector = new IExecDataProtector(provider);
    this.invoiceIApp = options.invoiceIApp || process.env.INVOICE_IAPP_ADDRESS;
    this.payrollIApp = options.payrollIApp || process.env.PAYROLL_IAPP_ADDRESS;
    this.settlementContract = options.settlementContract || process.env.SETTLEMENT_CONTRACT;
  }

  // Invoice Operations
  async createInvoice(invoiceData) {
    const invoice = {
      ...invoiceData,
      metadata: {
        ...invoiceData.metadata,
        invoiceId: `INV-${Date.now()}`,
        issueDate: Date.now(),
        status: 'DRAFT'
      }
    };

    const { address } = await this.dataProtector.protectData({
      data: invoice,
      name: `Invoice ${invoice.metadata.invoiceNumber}`
    });

    return { id: address, invoice };
  }

  async processInvoice(invoiceId) {
    await this.dataProtector.grantAccess({
      protectedData: invoiceId,
      authorizedApp: this.invoiceIApp,
      authorizedUser: ethers.ZeroAddress
    });

    const { taskId } = await this.dataProtector.processProtectedData({
      protectedData: invoiceId,
      app: this.invoiceIApp
    });

    return this.waitForTask(taskId);
  }

  // Payroll Operations
  async createPayrollBatch(batchData) {
    const batch = {
      ...batchData,
      metadata: {
        ...batchData.metadata,
        batchId: `BATCH-${Date.now()}`,
        status: 'DRAFT'
      }
    };

    const { address } = await this.dataProtector.protectData({
      data: batch,
      name: `Payroll ${batch.metadata.batchId}`
    });

    return { id: address, batch };
  }

  async processPayroll(batchId) {
    await this.dataProtector.grantAccess({
      protectedData: batchId,
      authorizedApp: this.payrollIApp,
      authorizedUser: ethers.ZeroAddress
    });

    const { taskId } = await this.dataProtector.processProtectedData({
      protectedData: batchId,
      app: this.payrollIApp
    });

    return this.waitForTask(taskId);
  }

  // Settlement Operations
  async claimPayment(voucher) {
    const settlement = await this.getSettlementContract();
    const tx = await settlement.claimVoucher(
      voucher.data,
      voucher.signature
    );
    return tx.wait();
  }

  async executeBatchPayment(vouchers) {
    const settlement = await this.getSettlementContract();
    
    // Prepare batch data
    const recipients = vouchers.map(v => v.data.recipientAddress);
    const amounts = vouchers.map(v => v.data.amount);
    const totalAmount = amounts.reduce((sum, amount) => 
      ethers.BigNumber.from(sum).add(ethers.BigNumber.from(amount)), 
      ethers.BigNumber.from(0)
    ).toString();
    
    const tx = await settlement.executeBatchPayment(
      ethers.id(JSON.stringify(vouchers)),
      vouchers[0].data.tokenContract,
      recipients,
      amounts,
      totalAmount,
      vouchers[0].data.taskId,
      vouchers[0].signature
    );
    
    return tx.wait();
  }

  // Helper Methods
  async waitForTask(taskId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await this.dataProtector.getResultFromCompletedTask({ taskId });
        if (result) return result;
      } catch (error) {
        if (!error.message.includes('not completed')) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Task timeout');
  }

  async getSettlementContract() {
    const signer = await this.provider.getSigner();
    const abi = [
      'function claimVoucher(tuple(address recipient, address tokenContract, uint256 amount, string taskId, uint256 timestamp, string nonce) voucher, bytes signature)',
      'function executeBatchPayment(bytes32 batchId, address tokenContract, address[] recipients, uint256[] amounts, uint256 totalAmount, string taskId, bytes signature)'
    ];
    return new ethers.Contract(this.settlementContract, abi, signer);
  }

  // Utility Methods
  async getTaskStatus(taskId) {
    // Implementation for checking task status
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    // Query iExec contracts for task status
    return 'COMPLETED'; // Placeholder
  }

  async exportAccountingData(result, format = 'quickbooks') {
    if (!result.accountingExports) {
      throw new Error('No accounting data available');
    }
    return result.accountingExports[format];
  }
}

export default ConFiClient;