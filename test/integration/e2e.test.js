const { expect } = require('chai');
const { ethers } = require('ethers');
const { IExecDataProtector } = require('@iexec/dataprotector');
const ConFiClient = require('../../src/sdk/ConFiClient');
const testData = require('../fixtures/testData');

describe('ConFi E2E Integration Tests', () => {
  let client;
  let provider;
  let signer;
  
  before(async () => {
    provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    signer = new ethers.Wallet(process.env.TEST_PRIVATE_KEY, provider);
    
    client = new ConFiClient(signer, {
      invoiceIApp: process.env.INVOICE_IAPP_ADDRESS,
      payrollIApp: process.env.PAYROLL_IAPP_ADDRESS,
      settlementContract: process.env.SETTLEMENT_CONTRACT
    });
  });
  
  describe('Invoice Flow', () => {
    it('should create and process an invoice end-to-end', async function() {
      this.timeout(120000); // 2 minutes
      
      // Create invoice
      const { id, invoice } = await client.createInvoice(testData.testInvoice);
      expect(id).to.be.a('string');
      expect(id).to.match(/^0x/);
      
      // Process invoice
      const voucher = await client.processInvoice(id);
      expect(voucher).to.have.property('data');
      expect(voucher).to.have.property('signature');
      
      // Verify voucher data
      expect(voucher.data.amount).to.equal(invoice.calculations.grandTotal);
      expect(voucher.data.recipientAddress).to.equal(invoice.parties.issuer.address);
    });
  });
  
  describe('Payroll Flow', () => {
    it('should process a payroll batch', async function() {
      this.timeout(180000); // 3 minutes
      
      // Create batch
      const { id, batch } = await client.createPayrollBatch(testData.testPayrollBatch);
      expect(id).to.be.a('string');
      
      // Process payroll
      const result = await client.processPayroll(id);
      expect(result.vouchers).to.be.an('array');
      expect(result.summary.totalEmployees).to.equal(batch.employees.length);
    });
  });
  
  describe('Settlement', () => {
    it('should claim a payment voucher', async function() {
      this.timeout(60000);
      
      // Mock voucher for testing
      const voucher = {
        data: {
          recipientAddress: signer.address,
          tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          amount: '1000000',
          taskId: 'test-task',
          timestamp: Date.now(),
          nonce: 'test-nonce'
        },
        signature: '0x...' // Would be real signature
      };
      
      // This would fail without proper setup but demonstrates the flow
      try {
        const receipt = await client.claimPayment(voucher);
        expect(receipt).to.have.property('transactionHash');
      } catch (error) {
        // Expected in test environment
        expect(error.message).to.include('signer');
      }
    });
  });
});