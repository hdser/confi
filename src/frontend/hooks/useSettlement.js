import { useState } from 'react';
import { ethers } from 'ethers';

export const useSettlement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const claimVoucher = async (voucher) => {
    setLoading(true);
    setError(null);
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const abi = [
        'function claimVoucher(tuple(address recipient, address tokenContract, uint256 amount, string taskId, uint256 timestamp, string nonce) voucher, bytes signature)'
      ];
      
      const contract = new ethers.Contract(
        process.env.REACT_APP_SETTLEMENT_CONTRACT,
        abi,
        signer
      );
      
      const tx = await contract.claimVoucher(voucher.data, voucher.signature);
      const receipt = await tx.wait();
      
      return receipt;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const executeBatchPayment = async (batchData) => {
    setLoading(true);
    setError(null);
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const abi = [
        'function executeBatchPayment(bytes32 batchId, address tokenContract, address[] recipients, uint256[] amounts, uint256 totalAmount, string taskId, bytes signature)'
      ];
      
      const contract = new ethers.Contract(
        process.env.REACT_APP_SETTLEMENT_CONTRACT,
        abi,
        signer
      );
      
      const tx = await contract.executeBatchPayment(
        batchData.batchId,
        batchData.tokenContract,
        batchData.recipients,
        batchData.amounts,
        batchData.totalAmount,
        batchData.taskId,
        batchData.signature
      );
      
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    claimVoucher,
    executeBatchPayment,
    loading,
    error
  };
};