module.exports = {
  testInvoice: {
    metadata: {
      invoiceNumber: 'TEST-001',
      paymentTerms: 'NET30',
      currency: 'USDC'
    },
    parties: {
      issuer: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3',
        businessName: 'Test Corp',
        email: 'billing@testcorp.com'
      },
      client: {
        address: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed',
        businessName: 'Client Inc',
        email: 'ap@client.com'
      }
    },
    lineItems: [{
      description: 'Consulting Services',
      quantity: 10,
      unitPrice: '100000000', // 100 USDC (6 decimals)
      taxRate: 0.1
    }],
    calculations: {
      subtotal: '1000000000',
      totalTax: '100000000',
      grandTotal: '1100000000'
    },
    payment: {
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1
    }
  },
  
  testPayrollBatch: {
    metadata: {
      batchId: 'TEST-BATCH-001',
      payPeriodStart: Date.now() - 14 * 24 * 60 * 60 * 1000,
      payPeriodEnd: Date.now() - 24 * 60 * 60 * 1000,
      payDate: Date.now() + 24 * 60 * 60 * 1000,
      status: 'PENDING_APPROVAL',
      frequency: 'BIWEEKLY'
    },
    employees: [
      {
        id: 'EMP-001',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3',
        personalInfo: {
          name: 'John Doe',
          employeeId: 'E001',
          department: 'Engineering'
        },
        compensation: {
          hoursWorked: 80,
          hourlyRate: '50000000', // $50/hour
          earnings: {
            regular: '4000000000',
            overtime: '0',
            bonus: '0'
          },
          deductions: {
            tax: {
              federal: '880000000',
              state: '200000000',
              fica: '306000000'
            },
            benefits: {
              healthInsurance: '200000000',
              retirement401k: '240000000'
            }
          },
          netPay: '2174000000'
        },
        paymentInfo: {
          method: 'CRYPTO',
          tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1
        }
      }
    ],
    summary: {
      totalEmployees: 1,
      totalGrossPay: '4000000000',
      totalDeductions: '1826000000',
      totalNetPay: '2174000000'
    }
  },
  
  testVoucher: {
    data: {
      type: 'INVOICE_PAYMENT',
      recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      amount: '1100000000',
      taskId: '0x1234567890abcdef',
      timestamp: Date.now(),
      nonce: 'test-nonce-123'
    },
    signature: '0x...',
    signerAddress: '0x...'
  }
};