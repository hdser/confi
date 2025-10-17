const { expect } = require('chai');
const { ethers } = require('ethers');
const PayrollBatchProcessor = require('../../src/iapp/payrollProcessor');
const testData = require('../fixtures/testData');

describe('Payroll Batch Processor', () => {
  let processor;
  
  beforeEach(() => {
    process.env.IEXEC_IN = '/tmp/iexec_in';
    process.env.IEXEC_OUT = '/tmp/iexec_out';
    process.env.IEXEC_TASK_ID = 'test-task-456';
    process.env.PAYROLL_SIGNING_KEY = ethers.Wallet.createRandom().privateKey;
    
    processor = new PayrollBatchProcessor();
  });
  
  describe('validateBatch', () => {
    it('should validate a correct batch', async () => {
      const result = await processor.validateBatch(testData.testPayrollBatch);
      expect(result).to.be.true;
    });
    
    it('should validate employee addresses', async () => {
      const invalidBatch = {
        ...testData.testPayrollBatch,
        employees: [{
          ...testData.testPayrollBatch.employees[0],
          walletAddress: 'invalid'
        }]
      };
      
      await expect(processor.validateBatch(invalidBatch))
        .to.be.rejectedWith('Invalid wallet address');
    });
  });
  
  describe('calculateCompensation', () => {
    it('should calculate net pay correctly', async () => {
      const batch = await processor.calculateCompensation(testData.testPayrollBatch);
      const employee = batch.employees[0];
      
      const grossPay = ethers.BigNumber.from(employee.compensation.earnings.regular);
      const totalDeductions = ethers.BigNumber.from('1826000000');
      const expectedNetPay = grossPay.sub(totalDeductions);
      
      expect(employee.compensation.netPay).to.equal(expectedNetPay.toString());
    });
  });
  
  describe('optimizeForGas', () => {
    it('should batch payments by token', async () => {
      const vouchers = [
        {
          type: 'SINGLE_PAYMENT',
          voucher: {
            data: {
              tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              recipientAddress: '0x1234...',
              amount: '1000000000'
            }
          }
        },
        {
          type: 'SINGLE_PAYMENT',
          voucher: {
            data: {
              tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              recipientAddress: '0x5678...',
              amount: '2000000000'
            }
          }
        }
      ];
      
      const optimized = processor.optimizeForGas(vouchers);
      
      expect(optimized).to.have.lengthOf(1);
      expect(optimized[0].type).to.equal('BATCH_PAYMENT');
      expect(optimized[0].data.payments).to.have.lengthOf(2);
    });
  });
});