import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { IExecDataProtector } from '@iexec/dataprotector';
import { ethers } from 'ethers';
import { discoverInjectedProviders, selectProviderFor } from './walletDiscovery';

import Navigation from './components/Navigation';
import InvoiceCreation from './components/InvoiceCreation';
import PayrollDashboard from './components/PayrollDashboard';
import VoucherClaim from './components/VoucherClaim';
import WalletModal from './components/WalletModal';

import './styles/main.css';

export const DataProtectorContext = createContext(null);

const ARB_SEPOLIA_CHAIN_ID = 421614;

const App = () => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [dataProtector, setDataProtector] = useState(null);
  const [dpError, setDpError] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const initializeDataProtector = async (provider) => {
    try {
      const ethersProvider = new ethers.BrowserProvider(provider);
      const network = await ethersProvider.getNetwork();
      const chainId = Number(network.chainId);

      console.log('🌐 Current chain ID:', chainId);

      if (chainId !== ARB_SEPOLIA_CHAIN_ID) {
        const error = `Wrong network! Please switch to Arbitrum Sepolia (Chain ID: ${ARB_SEPOLIA_CHAIN_ID})`;
        setDpError(error);
        console.error('❌', error);

        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x66eee' }],
          });
          return await initializeDataProtector(provider);
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x66eee',
                  chainName: 'Arbitrum Sepolia',
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
                  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
                }]
              });
              return await initializeDataProtector(provider);
            } catch (addError) {
              throw new Error('Failed to add Arbitrum Sepolia network');
            }
          }
          throw new Error('Please switch to Arbitrum Sepolia manually');
        }
      }

      console.log('✅ Connected to Arbitrum Sepolia');

      // SIMPLE initialization - just like the test example!
      const dp = new IExecDataProtector(provider);
      
      setDataProtector(dp);
      setDpError(null);
      
      console.log('✅ DataProtector initialized successfully');

    } catch (err) {
      console.error('❌ Failed to initialize DataProtector:', err);
      setDpError(err.message);
    }
  };

  const connectWallet = async (walletType) => {
    try {
      let provider = null;

      console.log(`🔍 Discovering ${walletType} provider...`);
      const discovered = await discoverInjectedProviders();
      provider = selectProviderFor(walletType, discovered);

      if (!provider) {
        alert(`${walletType} wallet not found! Please install it first.`);
        return;
      }

      console.log(`✅ Found ${walletType} provider`);

      const accounts = await provider.request({
        method: 'eth_requestAccounts'
      });

      setAccount(accounts[0]);

      const chainId = await provider.request({ method: 'eth_chainId' });
      setNetwork(parseInt(chainId, 16));

      await initializeDataProtector(provider);
      setConnected(true);
      setShowWalletModal(false);

      console.log(`✅ Connected with ${walletType}:`, accounts[0]);

    } catch (error) {
      console.error('❌ Error connecting wallet:', error);
      
      if (error.code === 4001) {
        alert('Connection rejected. Please try again.');
      } else {
        setDpError(error.message);
      }
    }
  };

  const disconnectWallet = () => {
    setConnected(false);
    setAccount(null);
    setNetwork(null);
    setDataProtector(null);
    setDpError(null);
    console.log('👋 Wallet disconnected');
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
      if (window.ethereum) {
        initializeDataProtector(window.ethereum);
      }
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  return (
    <DataProtectorContext.Provider value={{ dataProtector, dpError }}>
      <Router>
        <div className="app">
          <Navigation
            connected={connected}
            account={account}
            network={network}
            onConnect={() => setShowWalletModal(true)}
            onDisconnect={disconnectWallet}
          />
          <div className="container">
            {dpError && (
              <div className="error-banner">
                ⚠️ {dpError}
                <button
                  onClick={() => {
                    setDpError(null);
                    if (window.ethereum) {
                      initializeDataProtector(window.ethereum);
                    }
                  }}
                  style={{ marginLeft: '1rem', padding: '0.25rem 0.75rem' }}
                >
                  Retry
                </button>
              </div>
            )}
            {connected && network !== ARB_SEPOLIA_CHAIN_ID && (
              <div className="warning-banner">
                ⚠️ Wrong Network! Please switch to <strong>Arbitrum Sepolia</strong>
              </div>
            )}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/invoice" element={<InvoiceCreation />} />
              <Route path="/payroll" element={<PayrollDashboard />} />
              <Route path="/claim" element={<VoucherClaim />} />
            </Routes>
          </div>

          {showWalletModal && (
            <WalletModal
              onClose={() => setShowWalletModal(false)}
              onConnect={connectWallet}
            />
          )}
        </div>
      </Router>
    </DataProtectorContext.Provider>
  );
};

const Home = () => {
  return (
    <div className="home-container">
      <h1>Welcome to ConFi</h1>
      <h2>Confidential Finance Platform</h2>
      <p>Privacy-preserving invoicing and payroll powered by iExec confidential computing</p>
      <div className="info-box" style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(26, 31, 58, 0.9)', borderRadius: '8px' }}>
        <h3>🌐 Network: Arbitrum Sepolia Testnet</h3>
        <p><strong>Chain ID:</strong> 421614</p>
        <p><strong>Get ETH:</strong> <a href="https://faucet.quicknode.com/arbitrum/sepolia" target="_blank" rel="noopener noreferrer">QuickNode Faucet</a></p>
        <p><strong>Get RLC:</strong> <a href="https://explorer.iex.ec/arbitrum-sepolia/faucet" target="_blank" rel="noopener noreferrer">iExec Faucet</a></p>
      </div>
    </div>
  );
};

export default App;