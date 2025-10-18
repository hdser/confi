import React, { useState } from 'react';
import { ethers } from 'ethers';
import useDataProtector from '../hooks/useDataProtector';

const InvoiceCreation = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [taskId, setTaskId] = useState(null);
  
  const {
    protectData,
    grantAccess,
    processProtectedData,
    getResult,
    connected,
    reconnect,
    error: dpError
  } = useDataProtector();

  const INVOICE_IAPP_ADDRESS = process.env.REACT_APP_INVOICE_IAPP_ADDRESS || 
                               '0x2E7C6b329f2F96c8ee2D915Bd1f50370d84604C5';

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    if (!connected) {
      setStatus('Connecting to DataProtector...');
      await reconnect();
      if (!connected) {
        setStatus('Failed to connect. Please check MetaMask.');
        return;
      }
    }
    
    setLoading(true);
    setStatus('Initializing invoice creation...');

    try {
      // Get form data
      const formData = new FormData(e.target);
      
      // Create invoice data structure
      const invoiceData = {
        recipientAddress: formData.get('recipient'),
        tokenContract: formData.get('token') || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: ethers.parseUnits(formData.get('amount'), 6).toString(),
        timestamp: Date.now(),
        nonce: ethers.hexlify(ethers.randomBytes(16)),
        invoiceNumber: formData.get('invoiceNumber'),
        memo: formData.get('memo'),
        dueDate: new Date(formData.get('dueDate')).toISOString()
      };

      // Step 1: Protect the data
      setStatus('Step 1/4: Encrypting invoice data...');
      const protectedDataResult = await protectData(
        invoiceData, 
        `Invoice-${invoiceData.invoiceNumber}`
      );
      
      const protectedDataAddress = protectedDataResult.address;
      console.log('Protected data address:', protectedDataAddress);

      // Step 2: Grant access to the iApp
      setStatus('Step 2/4: Granting access to TEE processor...');
      await grantAccess(
        protectedDataAddress,
        INVOICE_IAPP_ADDRESS,
        ethers.ZeroAddress
      );

      // Step 3: Process in TEE
      setStatus('Step 3/4: Processing invoice in TEE...');
      const processResult = await processProtectedData(
        protectedDataAddress,
        INVOICE_IAPP_ADDRESS
      );
      
      const currentTaskId = processResult.taskId;
      setTaskId(currentTaskId);
      console.log('Task ID:', currentTaskId);

      // Step 4: Poll for result
      setStatus('Step 4/4: Waiting for voucher generation (30-90 seconds)...');
      let result = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!result && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          result = await getResult(currentTaskId);
          if (result) {
            setVoucher(result);
            setStatus('✅ Invoice processed successfully!');
            console.log('Voucher:', result);
          }
        } catch (err) {
          if (!err.message.includes('not completed')) {
            throw err;
          }
        }
        attempts++;
        setStatus(`Step 4/4: Waiting for voucher... (${attempts * 5}s)`);
      }

      if (!result) {
        throw new Error('Processing timeout - check task on iExec Explorer');
      }

    } catch (error) {
      console.error('Error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadVoucher = () => {
    if (!voucher) return;
    
    const dataStr = JSON.stringify(voucher, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `voucher-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="invoice-creation">
      <h2>Create Confidential Invoice</h2>
      
      {dpError && (
        <div className="error-message">
          ⚠️ DataProtector Error: {dpError}
        </div>
      )}
      
      <form onSubmit={handleCreateInvoice}>
        <div className="form-group">
          <label>Invoice Number *</label>
          <input
            name="invoiceNumber"
            placeholder="INV-001"
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Recipient Address *</label>
          <input
            name="recipient"
            placeholder="0x..."
            pattern="^0x[a-fA-F0-9]{40}$"
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Amount (USDC) *</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="100.00"
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Token Contract (optional)</label>
          <input
            name="token"
            placeholder="Default: USDC (0xA0b8...)"
            pattern="^0x[a-fA-F0-9]{40}$"
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Due Date *</label>
          <input
            name="dueDate"
            type="date"
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Memo/Description *</label>
          <textarea
            name="memo"
            rows="3"
            placeholder="Invoice for consulting services..."
            required
            disabled={loading}
          />
        </div>
        
        <button type="submit" disabled={loading || !connected}>
          {loading ? 'Processing...' : 'Create Invoice'}
        </button>
        
        {!connected && (
          <button type="button" onClick={reconnect}>
            Connect Wallet
          </button>
        )}
      </form>

      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : ''} ${status.includes('❌') ? 'error' : ''}`}>
          {status}
        </div>
      )}
      
      {taskId && (
        <div className="task-info">
          <p>Task ID: {taskId}</p>
          <a 
            href={`https://explorer.iex.ec/arbitrum-sepolia/${taskId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on iExec Explorer →
          </a>
        </div>
      )}
      
      {voucher && (
        <div className="voucher-display">
          <h3>Payment Voucher Generated</h3>
          <pre>{JSON.stringify(voucher, null, 2)}</pre>
          <div className="voucher-actions">
            <button onClick={downloadVoucher}>
              Download Voucher
            </button>
            <p>Send this voucher to the payer for payment</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreation;