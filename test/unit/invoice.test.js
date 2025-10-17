const { expect } = require('chai');
const { ethers } = require('ethers');
const InvoiceProcessor = require('../../src/iapp/invoiceProcessor');
const testData = require('../fixtures/testData');

describe('Invoice Processor', () => {
  let processor;
  
  beforeEach(() => {
    // Mock environment
    process.env.IEXEC_IN = '/tmp/iexec_in';
    process.env.IEXEC_OUT = '/tmp/iexec_out';
    process.env.IEXEC_TASK_ID = 'test-task-123';
    process.env.INVOICE_SIGNING_KEY = ethers.Wallet.createRandom().privateKey;
    
    processor = new InvoiceProcessor();
  });
  
  describe('validateInvoice', () => {
    it('should validate a correct invoice', async () => {
      const result = await processor.validateInvoice(testData.testInvoice);
      expect(result).to.be.true;
    });
    
    it('should reject invalid addresses', async () => {
      const invalidInvoice = {
        ...testData.testInvoice,
        parties: {
          issuer: { address: 'invalid' },
          client: { address: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed' }
        }
      };
      
      await expect(processor.validateInvoice(invalidInvoice))
        .to.be.rejectedWith('Invalid issuer address');
    });
    
    it('should verify calculation totals', async () => {
      const invoice = { ...testData.testInvoice };
      invoice.calculations.grandTotal = '999999999'; // Wrong total
      
      await expect(processor.validateInvoice(invoice))
        .to.be.rejectedWith('Total mismatch');
    });
  });
  
  describe('generatePaymentVoucher', () => {
    it('should generate a valid voucher', async () => {
      const voucher = await processor.generatePaymentVoucher(
        testData.testInvoice,
        { allApproved: true }
      );
      
      expect(voucher).to.have.property('data');
      expect(voucher).to.have.property('signature');
      expect(voucher.data.type).to.equal('INVOICE_PAYMENT');
      expect(voucher.data.amount).to.equal(testData.testInvoice.calculations.grandTotal);
    });
    
    it('should sign voucher with correct key', async () => {
      const voucher = await processor.generatePaymentVoucher(
        testData.testInvoice,
        { allApproved: true }
      );
      
      // Verify signature
      const messageHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(voucher.data))
      );
      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(messageHash),
        voucher.signature
      );
      
      expect(recoveredAddress).to.equal(processor.wallet.address);
    });
  });
  
  describe('handleRecurringInvoice', () => {
    it('should generate new invoice for recurring payment', async () => {
      const recurringInvoice = {
        ...testData.testInvoice,
        recurring: {
          enabled: true,
          frequency: 'MONTHLY',
          nextDate: Date.now() - 1000, // Past due
          occurrences: 5
        }
      };
      
      const newInvoice = await processor.handleRecurringInvoice(recurringInvoice);
      
      expect(newInvoice.recurring.occurrences).to.equal(4);
      expect(newInvoice.metadata.invoiceNumber).to.not.equal(recurringInvoice.metadata.invoiceNumber);
    });
  });
});