import React from 'react';
import { Link } from 'react-router-dom';

const Navigation = ({ connected, account, network, onConnect, onDisconnect }) => {
  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 1: return 'Ethereum';
      case 42161: return 'Arbitrum';
      case 421614: return 'Arbitrum Sepolia';
      default: return `Chain ${chainId}`;
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          ConFi
        </Link>

        <div className="nav-links">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/invoice" className="nav-link">Invoices</Link>
          <Link to="/payroll" className="nav-link">Payroll</Link>
          <Link to="/claim" className="nav-link">Claim</Link>
        </div>

        <div className="nav-wallet">
          {network && (
            <span className="network-badge">
              {getNetworkName(network)}
            </span>
          )}

          {connected ? (
            <>
              <span className="wallet-address">
                🔒 {formatAddress(account)}
              </span>
              <button className="disconnect-button" onClick={onDisconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="connect-button" onClick={onConnect}>
              🔌 Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;