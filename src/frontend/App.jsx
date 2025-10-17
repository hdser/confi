import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Components
import Navigation from './components/Navigation';
import InvoiceCreation from './components/InvoiceCreation';
import PayrollDashboard from './components/PayrollDashboard';
import VoucherClaim from './components/VoucherClaim';

// Styles
import './styles/main.css';

const App = () => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);

  useEffect(() => {
    checkConnection();
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

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setConnected(true);
          setAccount(accounts[0]);
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setNetwork(parseInt(chainId, 16));
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setConnected(true);
        setAccount(accounts[0]);
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        setNetwork(parseInt(chainId, 16));
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setConnected(false);
      setAccount(null);
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = (chainId) => {
    setNetwork(parseInt(chainId, 16));
    window.location.reload();
  };

  return (
    <Router>
      <div className="app">
        <Navigation 
          connected={connected}
          account={account}
          network={network}
          onConnect={connectWallet}
        />
        <div className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/invoice" element={<InvoiceCreation />} />
            <Route path="/payroll" element={<PayrollDashboard />} />
            <Route path="/claim" element={<VoucherClaim />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

const Home = () => {
  return (
    <div className="home-container">
      <h1>Welcome to ConFi</h1>
      <h2>Confidential Finance Platform</h2>
      <p>Privacy-preserving invoicing and payroll powered by iExec confidential computing</p>
      
      <div className="features-grid">
        <div className="feature-card">
          <h3>🔒 Confidential Invoicing</h3>
          <p>Create and process invoices with complete privacy. All sensitive data is encrypted and processed in secure enclaves.</p>
        </div>
        
        <div className="feature-card">
          <h3>💰 Secure Payroll</h3>
          <p>Batch process payroll for hundreds of employees efficiently while maintaining complete confidentiality.</p>
        </div>
        
        <div className="feature-card">
          <h3>⚡ Gas Optimized</h3>
          <p>Reduce transaction costs by up to 90% with intelligent batching and optimization.</p>
        </div>
        
        <div className="feature-card">
          <h3>📊 Enterprise Ready</h3>
          <p>Export to QuickBooks, Xero, and ADP. Full compliance reporting and audit trails.</p>
        </div>
      </div>
    </div>
  );
};

export default App;