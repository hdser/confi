import { useState, useEffect } from 'react';
import { IExecDataProtector } from '@iexec/dataprotector';
import { ethers } from 'ethers';

export const useDataProtector = () => {
  const [dataProtector, setDataProtector] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeDataProtector();
  }, []);

  const initializeDataProtector = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      
      const dp = new IExecDataProtector(signer);
      setDataProtector(dp);
    } catch (err) {
      setError(err.message);
    }
  };

  const protectData = async (data, name) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataProtector.protectData({ data, name });
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const grantAccess = async (protectedData, authorizedApp) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataProtector.grantAccess({
        protectedData,
        authorizedApp,
        authorizedUser: ethers.ZeroAddress
      });
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const processProtectedData = async (protectedData, app) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataProtector.processProtectedData({
        protectedData,
        app
      });
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getResult = async (taskId) => {
    try {
      const result = await dataProtector.getResultFromCompletedTask({ taskId });
      return result;
    } catch (err) {
      if (!err.message.includes('not completed')) {
        setError(err.message);
      }
      throw err;
    }
  };

  return {
    dataProtector,
    protectData,
    grantAccess,
    processProtectedData,
    getResult,
    loading,
    error
  };
};