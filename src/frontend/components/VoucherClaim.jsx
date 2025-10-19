import React, { useState } from 'react';
import { ethers } from 'ethers';

const VoucherClaim = () => {
  const [voucher, setVoucher] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  
  const steps = ['Paste Voucher', 'Verify Signature', 'Claim Payment'];

  const handleClaim = async () => {
    setLoading(true);
    setError('');
    
    try {
      setActiveStep(0);
      setStatus('Parsing voucher...');
      const voucherData = JSON.parse(voucher);
      
      if (!voucherData.data || !voucherData.signature) {
        throw new Error('Invalid voucher format');
      }
      
      setActiveStep(1);
      setStatus('Verifying signature...');
      
      if (!window.ethereum) {
        throw new Error('Please install MetaMask');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const settlementABI = [
        'function claimVoucher(tuple(address recipient, address tokenContract, uint256 amount, string taskId, uint256 timestamp, string nonce) voucher, bytes signature)'
      ];
      
      const settlementContract = new ethers.Contract(
        process.env.REACT_APP_SETTLEMENT_CONTRACT || '0x996b21dB6deD9D7D763C98d64EA536cf51061887',
        settlementABI,
        signer
      );
      
      setActiveStep(2);
      setStatus('Submitting claim to blockchain...');
      const tx = await settlementContract.claimVoucher(
        voucherData.data,
        voucherData.signature
      );
      
      setStatus('Waiting for confirmation...');
      const receipt = await tx.wait();
      
      setStatus(`✅ Payment claimed successfully! Transaction: ${receipt.hash}`);
      setActiveStep(3);
      
    } catch (err) {
      console.error('Claim error:', err);
      setError(err.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voucher-claim-container">
      <div className="claim-card">
        <h2>Claim Payment Voucher</h2>
        
        <div className="stepper">
          {steps.map((label, index) => (
            <div 
              key={label} 
              className={`step ${index <= activeStep ? 'active' : ''}`}
            >
              <div className="step-number">{index + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>
        
        <textarea
          className="voucher-input"
          rows={10}
          placeholder="Paste Payment Voucher JSON here..."
          value={voucher}
          onChange={(e) => setVoucher(e.target.value)}
          disabled={loading}
        />
        
        <button
          className="claim-button"
          onClick={handleClaim}
          disabled={!voucher || loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Processing...
            </>
          ) : (
            'Claim Payment'
          )}
        </button>
        
        {status && (
          <div className="status-message success">
            ℹ️ {status}
          </div>
        )}
        
        {error && (
          <div className="status-message error">
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoucherClaim;