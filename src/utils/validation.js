const { ethers } = require('ethers');

class ValidationUtils {
  static isValidAddress(address) {
    return ethers.isAddress(address);
  }

  static isValidAmount(amount) {
    try {
      const bn = ethers.BigNumber.from(amount);
      return bn.gt(0);
    } catch {
      return false;
    }
  }

  static validateInvoice(invoice) {
    const errors = [];

    if (!invoice.metadata?.invoiceNumber) {
      errors.push('Invoice number is required');
    }

    if (!this.isValidAddress(invoice.parties?.issuer?.address)) {
      errors.push('Invalid issuer address');
    }

    if (!this.isValidAddress(invoice.parties?.client?.address)) {
      errors.push('Invalid client address');
    }

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      errors.push('At least one line item is required');
    }

    if (!this.isValidAmount(invoice.calculations?.grandTotal)) {
      errors.push('Invalid total amount');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validatePayrollBatch(batch) {
    const errors = [];

    if (!batch.metadata?.batchId) {
      errors.push('Batch ID is required');
    }

    if (!batch.employees || batch.employees.length === 0) {
      errors.push('At least one employee is required');
    }

    for (const [index, employee] of batch.employees.entries()) {
      if (!this.isValidAddress(employee.walletAddress)) {
        errors.push(`Employee ${index}: Invalid wallet address`);
      }

      if (!this.isValidAmount(employee.compensation?.netPay)) {
        errors.push(`Employee ${index}: Invalid net pay amount`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateVoucher(voucher) {
    try {
      const required = ['data', 'signature', 'signerAddress'];
      for (const field of required) {
        if (!voucher[field]) {
          return { valid: false, error: `Missing ${field}` };
        }
      }

      if (!this.isValidAddress(voucher.data.recipientAddress)) {
        return { valid: false, error: 'Invalid recipient address' };
      }

      if (!this.isValidAmount(voucher.data.amount)) {
        return { valid: false, error: 'Invalid amount' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = ValidationUtils;