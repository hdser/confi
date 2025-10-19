// src/frontend/hooks/useDataProtector.js
import { useState, useEffect } from 'react';
import { IExecDataProtectorCore } from '@iexec/dataprotector';
import { IExec } from 'iexec';
import { ethers } from 'ethers';

export const useDataProtector = () => {
  const [dataProtectorCore, setDataProtectorCore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [rlcStatus, setRlcStatus] = useState({
    staked: 0,
    wallet: 0,
    locked: 0,
    isChecking: false,
    hasEnough: false
  });

  useEffect(() => {
    initializeDataProtector();
  }, []);

  const checkAndStakeRLC = async (signer) => {
    try {
      setRlcStatus(prev => ({ ...prev, isChecking: true }));
      
      const iexec = new IExec({
        ethProvider: signer,
        chainId: '421614' // Arbitrum Sepolia
      });
      
      const address = await signer.getAddress();
      const balances = await iexec.account.checkBalance(address);
      
      const status = {
        wallet: Number(balances.wei) / 1e9,
        staked: Number(balances.stake) / 1e9,
        locked: Number(balances.locked) / 1e9,
        isChecking: false,
        hasEnough: false
      };
      
      console.log('RLC Balance Check:', {
        wallet: `${status.wallet.toFixed(4)} RLC`,
        staked: `${status.staked.toFixed(4)} RLC`,
        locked: `${status.locked.toFixed(4)} RLC`
      });
      
      // Check if we need to stake more RLC
      const MIN_STAKED_RLC = 0.5; // Minimum staked RLC required
      
      if (status.staked < MIN_STAKED_RLC) {
        console.log(`⚠️ Insufficient staked RLC. Have ${status.staked.toFixed(4)}, need ${MIN_STAKED_RLC}`);
        
        // Check if we have enough RLC in wallet to stake
        const amountToStake = Math.max(1, MIN_STAKED_RLC - status.staked);
        
        if (status.wallet < amountToStake) {
          throw new Error(
            `Insufficient RLC. You have ${status.wallet.toFixed(4)} RLC in wallet but need ${amountToStake.toFixed(4)} RLC to stake. ` +
            `Please get RLC from: https://explorer.iex.ec/arbitrum-sepolia/faucet`
          );
        }
        
        // Auto-stake RLC
        console.log(`🔄 Auto-staking ${amountToStake} RLC...`);
        const depositAmount = Math.ceil(amountToStake * 1e9); // Convert to nRLC
        
        try {
          const tx = await iexec.account.deposit(depositAmount);
          console.log(`📝 Staking transaction: ${tx.txHash}`);
          console.log('⏳ Waiting for confirmation...');
          
          // Wait a bit for the transaction to be mined
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check balance again
          const newBalances = await iexec.account.checkBalance(address);
          status.staked = Number(newBalances.stake) / 1e9;
          status.wallet = Number(newBalances.wei) / 1e9;
          
          console.log(`✅ Successfully staked! New balance: ${status.staked.toFixed(4)} RLC`);
        } catch (stakeError) {
          console.error('❌ Staking failed:', stakeError);
          throw new Error(`Failed to stake RLC: ${stakeError.message}`);
        }
      }
      
      status.hasEnough = status.staked >= MIN_STAKED_RLC;
      setRlcStatus(status);
      
      return status;
    } catch (err) {
      setRlcStatus(prev => ({ ...prev, isChecking: false }));
      throw err;
    }
  };

  const initializeDataProtector = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed. Please install MetaMask to use this feature.');
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.');
      }
      
      // Create Web3 provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Check network
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      if (chainId !== 421614) {
        console.log(`Wrong network. Current: ${chainId}, Expected: 421614 (Arbitrum Sepolia)`);
        
        // Try to switch network automatically
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x66eee' }], // 421614 in hex
          });
          
          // Re-initialize after network switch
          return await initializeDataProtector();
        } catch (switchError) {
          if (switchError.code === 4902) {
            // Network not added, try to add it
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x66eee',
                  chainName: 'Arbitrum Sepolia',
                  nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
                  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
                }]
              });
              return await initializeDataProtector();
            } catch (addError) {
              throw new Error('Failed to add Arbitrum Sepolia network. Please add it manually.');
            }
          }
          throw new Error('Please switch to Arbitrum Sepolia network manually.');
        }
      }
      
      console.log('✅ Connected to Arbitrum Sepolia');
      
      // Check and stake RLC if needed
      console.log('🔍 Checking RLC status...');
      await checkAndStakeRLC(signer);
      
      // Initialize DataProtector with complete configuration
      console.log('🔧 Initializing DataProtector...');
      
      const dataProtector = new IExecDataProtectorCore(signer, {
        // Contract addresses - MUST be at root level
        dataprotectorContractAddress: '0x3a4Ab33F3D605e0b6FC8A83dc96c8FaCEda2E92C',
        sharingContractAddress: '0x3137B6DF4f36D338b82260eDBB2E7bab034AFEda',
        
        // Subgraph for event indexing
        subgraphUrl: 'https://thegraph-product.iex.ec/subgraphs/name/bellecour/dataprotector',
        
        // IPFS configuration
        ipfsGateway: 'https://ipfs-gateway.v8-bellecour.iex.ec',
        ipfsNode: 'https://ipfs-upload.v8-bellecour.iex.ec',
        
        // Default workerpool
        defaultWorkerpool: '0xC76A18c78B7e530A165c5683CB1aB134E21938B4',
        
        // iExec options
        iexecOptions: {
          smsURL: 'https://sms.scone-prod.v8-bellecour.iex.ec',
          resultProxyURL: 'https://result-proxy.v8-bellecour.iex.ec',
          
          // Bridge configuration for cross-chain
          bridgeAddress: '0x455c9B8953AB1957ad0A59D413631A66798c6a2',
          bridgedNetworkConf: {
            chainId: '134',
            host: 'https://bellecour.iex.ec',
            hubAddress: '0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f',
            smsURL: 'https://sms.scone-prod.v8-bellecour.iex.ec'
          }
        }
      });
      
      // Apply manual configuration patch if needed
      if (dataProtector && (!dataProtector.config || !dataProtector.config[421614])) {
        console.log('📝 Patching DataProtector configuration for Arbitrum Sepolia...');
        
        if (!dataProtector.config) {
          dataProtector.config = {};
        }
        
        dataProtector.config[421614] = {
          sharingContractAddress: '0x3137B6DF4f36D338b82260eDBB2E7bab034AFEda',
          defaultWorkerpool: '0xC76A18c78B7e530A165c5683CB1aB134E21938B4',
          dataprotectorContractAddress: '0x3a4Ab33F3D605e0b6FC8A83dc96c8FaCEda2E92C',
          subgraphUrl: 'https://thegraph-product.iex.ec/subgraphs/name/bellecour/dataprotector',
          ipfsGateway: 'https://ipfs-gateway.v8-bellecour.iex.ec',
          ipfsNode: 'https://ipfs-upload.v8-bellecour.iex.ec'
        };
      }
      
      setDataProtectorCore(dataProtector);
      setConnected(true);
      setError(null);
      
      console.log('✅ DataProtector initialized successfully');
      console.log(`💰 RLC Status - Staked: ${rlcStatus.staked.toFixed(4)} RLC, Wallet: ${rlcStatus.wallet.toFixed(4)} RLC`);
      
    } catch (err) {
      console.error('❌ Failed to initialize DataProtector:', err);
      setError(err.message);
      setConnected(false);
      setDataProtectorCore(null);
    }
  };

  const protectData = async (data, name) => {
    if (!dataProtectorCore) {
      throw new Error('DataProtector not initialized. Please connect your wallet first.');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Re-check RLC status before protecting data
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      console.log('🔍 Checking RLC before protecting data...');
      const rlcCheck = await checkAndStakeRLC(signer);
      
      if (!rlcCheck.hasEnough) {
        throw new Error(`Insufficient staked RLC. Please ensure you have at least 0.5 RLC staked.`);
      }
      
      console.log('🔐 Protecting data...');
      console.log('Data to protect:', data);
      console.log('Name:', name);
      
      const result = await dataProtectorCore.protectData({ 
        data, 
        name 
      });
      
      console.log('✅ Data protected successfully!');
      console.log('Protected data address:', result.address);
      console.log('Transaction hash:', result.transactionHash);
      
      return result;
      
    } catch (err) {
      console.error('❌ Error protecting data:', err);
      
      // Enhanced error handling
      if (err.message && err.message.includes('Event DatasetSchema not found')) {
        // Try to get more details
        setError(
          'Failed to encrypt data on blockchain. This could be due to:\n' +
          '1. Network congestion - please wait and try again\n' +
          '2. Subgraph indexing delay - wait 30 seconds and retry\n' +
          '3. RLC staking not confirmed - check your staked balance\n\n' +
          `Current staked RLC: ${rlcStatus.staked.toFixed(4)} RLC`
        );
      } else {
        setError(err.message);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const grantAccess = async (protectedData, authorizedApp, authorizedUser = ethers.ZeroAddress) => {
    if (!dataProtectorCore) {
      throw new Error('DataProtector not initialized');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔓 Granting access...');
      console.log('Protected data:', protectedData);
      console.log('Authorized app:', authorizedApp);
      console.log('Authorized user:', authorizedUser);
      
      const result = await dataProtectorCore.grantAccess({
        protectedData,
        authorizedApp,
        authorizedUser
      });
      
      console.log('✅ Access granted successfully');
      return result;
      
    } catch (err) {
      console.error('❌ Error granting access:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const processProtectedData = async (protectedData, app, maxPrice = 0, args = '', inputFiles = [], secrets = {}) => {
    if (!dataProtectorCore) {
      throw new Error('DataProtector not initialized');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('⚙️ Processing protected data...');
      console.log('Protected data:', protectedData);
      console.log('App:', app);
      
      const result = await dataProtectorCore.processProtectedData({
        protectedData,
        app,
        maxPrice,
        args,
        inputFiles,
        secrets
      });
      
      console.log('✅ Processing started successfully');
      console.log('Task ID:', result.taskId);
      
      return result;
      
    } catch (err) {
      console.error('❌ Error processing data:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getResult = async (taskId) => {
    if (!dataProtectorCore) {
      throw new Error('DataProtector not initialized');
    }
    
    try {
      console.log('📥 Fetching result for task:', taskId);
      
      const result = await dataProtectorCore.getResultFromCompletedTask({ 
        taskId 
      });
      
      console.log('✅ Result retrieved successfully');
      return result;
      
    } catch (err) {
      if (!err.message.includes('not completed')) {
        console.error('❌ Error fetching result:', err);
        setError(err.message);
      }
      throw err;
    }
  };

  const reconnect = async () => {
    console.log('🔄 Reconnecting...');
    setError(null);
    await initializeDataProtector();
  };

  const checkRLCBalance = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return await checkAndStakeRLC(signer);
    } catch (err) {
      console.error('Error checking RLC:', err);
      return rlcStatus;
    }
  };

  return {
    // Core DataProtector instance
    dataProtectorCore,
    
    // Main functions
    protectData,
    grantAccess,
    processProtectedData,
    getResult,
    
    // Status and state
    loading,
    error,
    connected,
    rlcStatus,
    
    // Utility functions
    reconnect,
    checkRLCBalance,
    
    // For debugging
    initializeDataProtector
  };
};

export default useDataProtector;