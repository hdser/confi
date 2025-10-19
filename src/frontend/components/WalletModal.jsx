import React, { useState, useEffect } from 'react';
import { discoverInjectedProviders, installedFlags } from '../walletDiscovery';

const WalletModal = ({ onClose, onConnect }) => {
  const [installedWallets, setInstalledWallets] = useState({});
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let cancel = false;
    
    (async () => {
      const discovered = await discoverInjectedProviders();
      if (cancel) return;
      
      const flags = installedFlags(discovered);
      setInstalledWallets(flags);
      setScanning(false);
      
      console.log('🔍 EIP-6963 Discovery completed');
      console.log('📱 Discovered providers:', discovered);
      console.log('✅ Installed wallets:', flags);
    })();

    return () => { cancel = true; };
  }, []);

  const wallets = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      description: 'Connect with MetaMask',
      downloadUrl: 'https://metamask.io/download/'
    },
    {
      id: 'rabby',
      name: 'Rabby Wallet',
      icon: '🐰',
      description: 'Connect with Rabby',
      downloadUrl: 'https://rabby.io/'
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      icon: '🌈',
      description: 'Connect with Rainbow Wallet',
      downloadUrl: 'https://rainbow.me/extension'
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: '🔵',
      description: 'Connect with Coinbase Wallet',
      downloadUrl: 'https://www.coinbase.com/wallet'
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: '🛡️',
      description: 'Connect with Trust Wallet',
      downloadUrl: 'https://trustwallet.com/'
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: '🔗',
      description: 'Scan with mobile wallet',
      downloadUrl: null
    }
  ];

  const handleWalletClick = (walletId) => {
    const isInstalled = installedWallets[walletId] || walletId === 'walletconnect';
    
    if (!isInstalled && walletId !== 'walletconnect') {
      const wallet = wallets.find(w => w.id === walletId);
      if (wallet?.downloadUrl) {
        window.open(wallet.downloadUrl, '_blank');
      }
      return;
    }

    onConnect(walletId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Wallet</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            {scanning ? 'Scanning for wallets...' : 'Choose your preferred wallet to connect to ConFi'}
          </p>

          {scanning ? (
            <div className="scanning-indicator">
              <div className="spinner-large"></div>
              <p>Detecting installed wallets...</p>
            </div>
          ) : (
            <div className="wallet-list">
              {wallets.map((wallet) => {
                const installed = installedWallets[wallet.id] || wallet.id === 'walletconnect';
                return (
                  <button
                    key={wallet.id}
                    className={`wallet-option ${!installed ? 'not-installed' : ''}`}
                    onClick={() => handleWalletClick(wallet.id)}
                  >
                    <span className="wallet-icon">{wallet.icon}</span>
                    <div className="wallet-info">
                      <span className="wallet-name">{wallet.name}</span>
                      <span className="wallet-description">
                        {installed ? wallet.description : 'Not installed - Click to install'}
                      </span>
                    </div>
                    {installed ? (
                      <span className="connect-badge">Connect</span>
                    ) : (
                      <span className="install-badge">Install</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="modal-footer">
            <p className="modal-note">
              New to Ethereum? <a href="https://ethereum.org/wallets" target="_blank" rel="noopener noreferrer">Learn about wallets</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;