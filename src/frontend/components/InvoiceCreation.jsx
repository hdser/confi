import React, { useState } from 'react';
import { IExecDataProtector } from '@iexec/dataprotector';
import { ethers } from 'ethers';

const InvoiceCreation = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState(null);

  const INVOICE_IAPP_ADDRESS = process.env.REACT_APP_INVOICE_IAPP_ADDRESS;

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Initializing...');

    try {
      // Connect wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      // Initialize DataProtector with experimental flag for Arbitrum
      const dataProtector = new IExecDataProtector(signer, {
        allowExperimentalNetworks: true
      });

      // Create invoice data matching the iApp expected format
      const invoiceData = {
        payerAddress: e.target.payer.value,
        recipientAddress: e.target.recipient.value,
        tokenContract: e.target.token.value || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        amount: ethers.parseUnits(e.target.amount.value, 6).toString(),
        memo: e.target.memo.value,
        dueDate: new Date(e.target.dueDate.value).toISOString(),
        nonce: Date.now().toString()
      };

      // Step 1: Protect the data
      setStatus('Encrypting invoice data...');
      const { address: protectedDataAddress } = await dataProtector.protectData({
        data: invoiceData,
        name: `Invoice-${Date.now()}`
      });

      console.log('Protected data address:', protectedDataAddress);

      // Step 2: Grant access to the iApp
      setStatus('Granting access to confidential processor...');
      await dataProtector.grantAccess({
        protectedData: protectedDataAddress,
        authorizedApp: INVOICE_IAPP_ADDRESS,
        authorizedUser: ethers.ZeroAddress // Anyone can process
      });

      // Step 3: Process the protected data
      setStatus('Processing invoice in TEE...');
      const { taskId } = await dataProtector.processProtectedData({
        protectedData: protectedDataAddress,
        app: INVOICE_IAPP_ADDRESS
      });

      console.log('Task ID:', taskId);

      // Step 4: Wait for completion and get result
      setStatus('Waiting for voucher generation...');
      let result = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!result && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          result = await dataProtector.getResultFromCompletedTask({ taskId });
          if (result) {
            setVoucher(result);
            setStatus('Invoice processed successfully!');
            console.log('Voucher:', result);
          }
        } catch (err) {
          if (!err.message.includes('not completed')) {
            throw err;
          }
        }
        attempts++;
      }

      if (!result) {
        throw new Error('Task timeout');
      }

    } catch (error) {
      console.error('Error:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invoice-creation">
      <h2>Create Confidential Invoice</h2>
      
      <form onSubmit={handleCreateInvoice}>
        <input
          name="payer"
          placeholder="Payer Address (0x...)"
          required
        />
        
        <input
          name="recipient"
          placeholder="Recipient Address (0x...)"
          required
        />
        
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Amount (USDC)"
          required
        />
        
        <input
          name="token"
          placeholder="Token Contract (optional)"
        />
        
        <input
          name="dueDate"
          type="date"
          required
        />
        
        <textarea
          name="memo"
          placeholder="Invoice memo/description"
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Create Invoice'}
        </button>
      </form>

      {status && <div className="status">{status}</div>}
      
      {voucher && (
        <div className="voucher-display">
          <h3>Payment Voucher Generated</h3>
          <pre>{JSON.stringify(voucher, null, 2)}</pre>
          <p>Send this voucher to the payer for payment</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreation;