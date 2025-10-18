import { useState, useEffect } from 'react';
import { IExecDataProtector } from '@iexec/dataprotector';
import { ethers } from 'ethers';

export const useDataProtector = () => {
  const [dataProtector, setDataProtector] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    initializeDataProtector();
  }, []);

  const initializeDataProtector = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      // Create Web3 provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Initialize DataProtector with signer
      const dp = new IExecDataProtector(signer, {
        ipfsNode: 'https://ipfs.iex.ec',
        ipfsGateway: 'https://gateway.ipfs.iex.ec'
      });
      
      setDataProtector(dp);
      setConnected(true);
      setError(null);
      
      console.log('DataProtector initialized successfully');
    } catch (err) {
      console.error('Failed to initialize DataProtector:', err);
      setError(err.message);
      setConnected(false);
    }
  };

  const protectData = async (data, name) => {
    if (!dataProtector) {
      throw new Error('DataProtector not initialized');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataProtector.protectData({ 
        data, 
        name 
      });
      console.log('Data protected:', result.address);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const grantAccess = async (protectedData, authorizedApp, authorizedUser = ethers.ZeroAddress) => {
    if (!dataProtector) {
      throw new Error('DataProtector not initialized');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataProtector.grantAccess({
        protectedData,
        authorizedApp,
        authorizedUser
      });
      console.log('Access granted');
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const processProtectedData = async (protectedData, app, maxPrice = 0, args = '', inputFiles = [], secrets = {}) => {
    if (!dataProtector) {
      throw new Error('DataProtector not initialized');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataProtector.processProtectedData({
        protectedData,
        app,
        maxPrice,
        args,
        inputFiles,
        secrets
      });
      console.log('Processing started, task ID:', result.taskId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getResult = async (taskId) => {
    if (!dataProtector) {
      throw new Error('DataProtector not initialized');
    }
    
    try {
      const result = await dataProtector.getResultFromCompletedTask({ 
        taskId 
      });
      return result;
    } catch (err) {
      if (!err.message.includes('not completed')) {
        setError(err.message);
      }
      throw err;
    }
  };

  const reconnect = async () => {
    await initializeDataProtector();
  };

  return {
    dataProtector,
    protectData,
    grantAccess,
    processProtectedData,
    getResult,
    loading,
    error,
    connected,
    reconnect
  };
};

export default useDataProtector;