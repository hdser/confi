import React, { useState, useContext } from 'react';
import { ethers } from 'ethers';
import { DataProtectorContext } from '../App';

const InvoiceCreation = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [protectedDataAddress, setProtectedDataAddress] = useState(null);
  
  const { dataProtector, dpError } = useContext(DataProtectorContext);

  const INVOICE_IAPP_ADDRESS = process.env.REACT_APP_INVOICE_IAPP_ADDRESS || 
                               '0x2E7C6b329f2F96c8ee2D915Bd1f50370d84604C5';

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    if (!dataProtector) {
      setStatus('❌ Error: Please connect your wallet first');
      return;
    }
    
    setLoading(true);
    setStatus('🔄 Initializing invoice creation...');
    setVoucher(null);
    setTaskId(null);
    setProtectedDataAddress(null);

    try {
      const formData = new FormData(e.target);
      
      const recipientAddress = formData.get('recipient');
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid recipient address');
      }

      const amountInput = formData.get('amount');
      if (!amountInput || parseFloat(amountInput) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const amountInUnits = ethers.parseUnits(amountInput, 6).toString();
      const tokenContract = formData.get('token') || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      
      if (!ethers.isAddress(tokenContract)) {
        throw new Error('Invalid token contract address');
      }

      // Create FLAT invoice data structure (like test example)
      // Each field is a top-level string property
      const invoiceData = {
        recipientAddress: recipientAddress,
        tokenContract: tokenContract,
        amount: amountInUnits,
        timestamp: String(Date.now()),
        nonce: ethers.hexlify(ethers.randomBytes(16)),
        invoiceNumber: formData.get('invoiceNumber'),
        memo: formData.get('memo') || 'Payment invoice',
        dueDate: new Date(formData.get('dueDate')).toISOString()
      };

      console.log('📋 Invoice data prepared:', invoiceData);

      // Step 1: Protect the data
      setStatus('Step 1/4: 🔐 Encrypting invoice data...');
      console.log('🔐 Protecting data with DataProtector...');
      
      const protectResult = await dataProtector.core.protectData({
        data: invoiceData,
        name: `Invoice-${invoiceData.invoiceNumber}`
      });
      
      const currentProtectedDataAddress = protectResult.address;
      setProtectedDataAddress(currentProtectedDataAddress);
      console.log('✅ Protected data address:', currentProtectedDataAddress);

      // Step 2: Grant access to the iApp
      setStatus('Step 2/4: 🔓 Granting access to TEE processor...');
      console.log('🔓 Granting access to iApp:', INVOICE_IAPP_ADDRESS);
      
      await dataProtector.core.grantAccess({
        protectedData: currentProtectedDataAddress,
        authorizedApp: INVOICE_IAPP_ADDRESS,
        authorizedUser: ethers.ZeroAddress
      });
      console.log('✅ Access granted to iApp');

      // Step 3: Process in TEE
      setStatus('Step 3/4: ⚙️ Processing invoice in secure TEE...');
      console.log('⚙️ Starting TEE processing...');
      
      const processResult = await dataProtector.core.processProtectedData({
        protectedData: currentProtectedDataAddress,
        app: INVOICE_IAPP_ADDRESS,
        workerpool: '0xB967057a21dc6A66A29721d96b8Aa7454B7c383F' // Arbitrum Sepolia TEE workerpool
      });
      
      const currentTaskId = processResult.taskId;
      setTaskId(currentTaskId);
      console.log('✅ Task created:', currentTaskId);

      // Step 4: Poll for result
      setStatus('Step 4/4: ⏳ Waiting for voucher generation (30-90 seconds)...');
      let result = null;
      let attempts = 0;
      const maxAttempts = 40;
      const baseDelay = 3000;

      while (!result && attempts < maxAttempts) {
        const delay = Math.min(baseDelay + (attempts * 500), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
          result = await dataProtector.core.getResultFromCompletedTask({
            taskId: currentTaskId
          });
          
          if (result) {
            console.log('✅ RAW RESULT:', result);
            
            let parsedResult;
            try {
              parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
              console.log('✅ PARSED RESULT:', parsedResult);
            } catch (parseError) {
              console.log('⚠️ Result is not JSON:', result);
              parsedResult = { raw: result };
            }
            
            setVoucher(parsedResult);
            setStatus('✅ Invoice processed successfully! Payment voucher generated.');
            console.log('🎉 Voucher generated successfully');
          }
        } catch (err) {
          if (!err.message.includes('not completed') && !err.message.includes('TASK_NOT_FOUND')) {
            console.error('Error fetching result:', err);
          }
        }
        
        attempts++;
        const elapsed = Math.round(attempts * delay / 1000);
        const progress = Math.round((attempts / maxAttempts) * 100);
        setStatus(`Step 4/4: ⏳ Waiting for voucher... (${progress}% - ${elapsed}s elapsed)`);
      }

      if (!result) {
        console.log('⚠️ Task timeout reached');
        setStatus(`⏳ Task may still be processing. Task ID: ${currentTaskId}`);
        throw new Error('Processing timeout - check task on iExec Explorer');
      }

    } catch (error) {
      console.error('❌ Invoice creation error:', error);
      
      let errorMessage = '❌ Error: ';
      
      if (error.message?.includes('User denied') || error.message?.includes('rejected')) {
        errorMessage += 'Transaction was cancelled by user.';
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('Insufficient RLC')) {
        errorMessage += error.message + '\n\nGet testnet RLC from: https://explorer.iex.ec/arbitrum-sepolia/faucet';
      } else if (error.message?.includes('timeout')) {
        errorMessage += 'Processing is taking longer than expected. Check the iExec Explorer link.';
      } else {
        errorMessage += error.message || 'Failed to create invoice. Please try again.';
      }
      
      setStatus(errorMessage);
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
    link.setAttribute('download', `invoice-voucher-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="invoice-creation">
      <h2>📄 Create Confidential Invoice</h2>
      <p className="subtitle">
        All invoice data is encrypted end-to-end and processed in a secure Intel SGX enclave
      </p>
      
      {dpError && (
        <div className="error-message">
          ⚠️ DataProtector Error: {dpError}
        </div>
      )}

      {!dataProtector && (
        <div className="warning-banner">
          ⚠️ Please connect your wallet to create invoices
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
          <label>Recipient Wallet Address *</label>
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
            placeholder="Default: USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)"
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
            min={new Date().toISOString().split('T')[0]}
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
        
        <button type="submit" disabled={loading || !dataProtector}>
          {loading ? '⏳ Processing Securely...' : '🚀 Create Invoice'}
        </button>
      </form>

      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : ''} ${status.includes('❌') ? 'error' : ''}`}>
          {status.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {protectedDataAddress && (
        <div className="protected-data-info">
          <p><strong>🔐 Encrypted Data Address:</strong></p>
          <code>{protectedDataAddress}</code>
        </div>
      )}
      
      {taskId && (
        <div className="task-info">
          <p><strong>Task ID:</strong></p>
          <code>{taskId}</code>
          <a 
            href={`https://explorer.iex.ec/arbitrum-sepolia/${taskId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="explorer-link"
          >
            📊 View Task on iExec Explorer →
          </a>
        </div>
      )}
      
      {voucher && (
        <div className="voucher-display">
          <h3>✅ Payment Voucher Generated</h3>
          
          <div className="voucher-summary">
            <p><strong>Recipient:</strong> <code>{voucher.data?.recipient}</code></p>
            <p><strong>Amount:</strong> {voucher.data?.amount ? ethers.formatUnits(voucher.data.amount, 6) : 'N/A'} USDC</p>
            <p><strong>Invoice Number:</strong> {voucher.metadata?.invoiceNumber}</p>
            <p><strong>Signer:</strong> <code>{voucher.signerAddress}</code></p>
          </div>

          <details>
            <summary>View Full Voucher Data</summary>
            <pre>{JSON.stringify(voucher, null, 2)}</pre>
          </details>
          
          <button onClick={downloadVoucher} className="download-button">
            💾 Download Voucher
          </button>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreation;