import React, { useState, useEffect } from 'react';

const WalletDebugger = () => {
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const info = {
      hasEthereum: !!window.ethereum,
      hasProviders: !!window.ethereum?.providers,
      providersCount: window.ethereum?.providers?.length || 0,
      mainProvider: {
        isMetaMask: window.ethereum?.isMetaMask,
        isRabby: window.ethereum?.isRabby,
        isRainbow: window.ethereum?.isRainbow,
        isCoinbaseWallet: window.ethereum?.isCoinbaseWallet,
        isTrust: window.ethereum?.isTrust,
      },
      allProviders: window.ethereum?.providers?.map((p, i) => ({
        index: i,
        isMetaMask: p.isMetaMask,
        isRabby: p.isRabby,
        isRainbow: p.isRainbow,
        isCoinbaseWallet: p.isCoinbaseWallet,
        isTrust: p.isTrust,
      })) || [],
      otherGlobals: {
        hasRainbow: !!window.rainbow,
        hasCoinbaseExtension: !!window.coinbaseWalletExtension,
        hasTrustWallet: !!window.trustwallet,
      }
    };
    
    setDebugInfo(info);
    console.log('🐛 Wallet Debug Info:', info);
  }, []);

  if (!debugInfo) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: '#00ff00',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '400px',
      maxHeight: '300px',
      overflow: 'auto',
      zIndex: 9999,
      border: '1px solid #00ff00',
      fontFamily: 'monospace'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#00D4FF' }}>
        🐛 Wallet Debugger
      </div>
      
      <div style={{ marginBottom: '5px' }}>
        <strong>window.ethereum:</strong> {debugInfo.hasEthereum ? '✅' : '❌'}
      </div>
      
      <div style={{ marginBottom: '5px' }}>
        <strong>Providers array:</strong> {debugInfo.hasProviders ? `✅ (${debugInfo.providersCount})` : '❌'}
      </div>
      
      {debugInfo.hasProviders && (
        <div style={{ marginLeft: '10px', marginBottom: '10px' }}>
          {debugInfo.allProviders.map(p => (
            <div key={p.index} style={{ marginBottom: '5px', color: '#FFD54F' }}>
              Provider {p.index}:
              {p.isRabby && ' 🐰Rabby'}
              {p.isMetaMask && !p.isRabby && ' 🦊MetaMask'}
              {p.isRainbow && ' 🌈Rainbow'}
              {p.isCoinbaseWallet && ' 🔵Coinbase'}
              {p.isTrust && ' 🛡️Trust'}
            </div>
          ))}
        </div>
      )}
      
      {!debugInfo.hasProviders && (
        <div style={{ marginLeft: '10px', marginBottom: '10px' }}>
          <strong>Main provider flags:</strong>
          <div style={{ marginLeft: '10px' }}>
            {debugInfo.mainProvider.isRabby && '🐰 isRabby: true'}
            {debugInfo.mainProvider.isMetaMask && '🦊 isMetaMask: true'}
            {debugInfo.mainProvider.isRainbow && '🌈 isRainbow: true'}
            {debugInfo.mainProvider.isCoinbaseWallet && '🔵 isCoinbaseWallet: true'}
            {debugInfo.mainProvider.isTrust && '🛡️ isTrust: true'}
          </div>
        </div>
      )}
      
      <div style={{ fontSize: '10px', color: '#888', marginTop: '10px' }}>
        Check browser console for full details
      </div>
    </div>
  );
};

export default WalletDebugger;