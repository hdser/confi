// EIP-6963 + legacy injected provider discovery

export function discoverInjectedProviders({ pollMs = 50, polls = 20 } = {}) {
  return new Promise((resolve) => {
    const found = new Map(); // key: id string, value: { provider, info }
    let finished = false;

    const done = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      resolve(found);
    };

    const onAnnounce = (event) => {
      const { provider, info } = event.detail || {};
      if (!provider || !info) return;
      const id = (info.rdns || info.uuid || info.name || '').toLowerCase();
      if (!found.has(id)) found.set(id, { provider, info });
    };

    // EIP-6963: listen for announcements, then request them
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch {}

    // Legacy: wait for ethereum initialization or poll a few times
    const onEthereumInitialized = () => {
      // Collect legacy providers
      const eth = window.ethereum;
      if (eth) {
        // Multi-provider (some wallets expose this)
        if (Array.isArray(eth.providers)) {
          for (const p of eth.providers) addLegacy(p);
        } else {
          addLegacy(eth);
        }
      }
      // Rainbow/Trust/Coinbase sometimes also expose globals
      if (window.rainbow) addLegacy(window.rainbow, { name: 'Rainbow', rdns: 'me.rainbow' });
      if (window.trustwallet) addLegacy(window.trustwallet, { name: 'Trust Wallet', rdns: 'com.trustwallet' });
      if (window.coinbaseWalletExtension) {
        addLegacy(window.coinbaseWalletExtension, { name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet' });
      }
    };

    const addLegacy = (provider, fallbackInfo) => {
      if (!provider) return;
      const idGuess = (
        provider.isRabby ? 'io.rabby' :
        provider.isMetaMask ? 'io.metamask' :
        provider.isCoinbaseWallet ? 'com.coinbase.wallet' :
        provider.isRainbow ? 'me.rainbow' :
        provider.isTrust ? 'com.trustwallet' :
        (fallbackInfo?.rdns || 'legacy.unknown')
      ).toLowerCase();

      const nameGuess = (
        provider.isRabby ? 'Rabby Wallet' :
        provider.isMetaMask ? 'MetaMask' :
        provider.isCoinbaseWallet ? 'Coinbase Wallet' :
        provider.isRainbow ? 'Rainbow' :
        provider.isTrust ? 'Trust Wallet' :
        (fallbackInfo?.name || 'Injected Wallet')
      );

      if (!found.has(idGuess)) {
        found.set(idGuess, { provider, info: { name: nameGuess, rdns: idGuess, uuid: idGuess } });
      }
    };

    // Wait for ethereum#initialized OR poll a few times
    let pollsLeft = polls;
    let pollTimer = null;

    const tryPoll = () => {
      onEthereumInitialized();
      if (pollsLeft-- <= 0) {
        clearInterval(pollTimer);
        setTimeout(done, 10);
      }
    };

    window.addEventListener('ethereum#initialized', tryPoll, { once: true });
    pollTimer = setInterval(tryPoll, pollMs);
    tryPoll();
  });
}

/** Utility to map your IDs to discovered providers */
export function selectProviderFor(walletId, discovered) {
  const entries = Array.from(discovered.values());

  const findBy = (pred) => entries.find(({ info, provider }) => pred(info, provider))?.provider;

  switch (walletId) {
    case 'rabby':
      return findBy((info, p) =>
        /rabby/.test((info.rdns || info.name || '').toLowerCase()) || p.isRabby
      );
    case 'metamask':
      return findBy((info, p) =>
        /metamask/.test((info.rdns || info.name || '').toLowerCase()) || (p.isMetaMask && !p.isRabby)
      );
    case 'coinbase':
      return findBy((info, p) =>
        /coinbase/.test((info.rdns || info.name || '').toLowerCase()) || p.isCoinbaseWallet
      );
    case 'rainbow':
      return findBy((info, p) =>
        /rainbow/.test((info.rdns || info.name || '').toLowerCase()) || p.isRainbow
      );
    case 'trust':
      return findBy((info, p) =>
        /trust/.test((info.rdns || info.name || '').toLowerCase()) || p.isTrust
      );
    default:
      return entries[0]?.provider || window.ethereum || null;
  }
}

/** Convenience booleans for UI badges */
export function installedFlags(discovered) {
  const entries = Array.from(discovered.values());
  const has = (re) => entries.some(({ info, provider }) =>
    re.test((info.rdns || info.name || '').toLowerCase())
  );
  const hasP = (pred) => entries.some(({ provider }) => pred(provider));

  return {
    metamask: has(/metamask/) || hasP(p => p.isMetaMask && !p.isRabby),
    rabby:    has(/rabby/)    || hasP(p => p.isRabby),
    coinbase: has(/coinbase/) || hasP(p => p.isCoinbaseWallet),
    rainbow:  has(/rainbow/)  || hasP(p => p.isRainbow),
    trust:    has(/trust/)    || hasP(p => p.isTrust),
  };
}