import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  WalletName,
  ConnectedSolanaWallet,
  WalletAdapterInfo,
  getAvailableWallets,
  connectWalletProvider,
  fetchWalletSolBalance,
  handleMobileConnectCallback,
  isMobileDevice,
  SOLANA_MAINNET_RPC
} from '../utils/solanaWallet';

interface SolanaWalletContextType {
  connectedWallet: ConnectedSolanaWallet | null;
  shortenedAddress: string | null;
  solBalance: number | null;
  isConnecting: boolean;
  isRefreshingBalance: boolean;
  walletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;
  connectWallet: (walletName: WalletName, forceMobileDeepLink?: boolean) => Promise<ConnectedSolanaWallet>;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  availableWallets: WalletAdapterInfo[];
  isMobile: boolean;
  network: 'mainnet-beta';
}

const SolanaWalletContext = createContext<SolanaWalletContextType | undefined>(undefined);

const STORAGE_KEY_WALLET_NAME = 'surchi_connected_wallet_name';
const STORAGE_KEY_WALLET_ADDR = 'surchi_connected_wallet_addr';

export const SolanaWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectedWallet, setConnectedWallet] = useState<ConnectedSolanaWallet | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletAdapterInfo[]>([]);

  const isMobile = isMobileDevice();
  const connectionRef = useRef<Connection>(new Connection(SOLANA_MAINNET_RPC, 'confirmed'));

  const shortenedAddress = connectedWallet
    ? `${connectedWallet.address.slice(0, 4)}...${connectedWallet.address.slice(-4)}`
    : null;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update available wallets
  const updateAvailableWallets = useCallback(() => {
    setAvailableWallets(getAvailableWallets());
  }, []);

  // Balance fetcher
  const refreshBalance = useCallback(async () => {
    if (!connectedWallet) return;
    setIsRefreshingBalance(true);
    try {
      const balance = await fetchWalletSolBalance(connectionRef.current, connectedWallet.publicKey);
      setSolBalance(balance);
    } catch (err) {
      console.warn('[SolanaWalletContext] Balance refresh error:', err);
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [connectedWallet]);

  // Handle Account Change from wallet provider
  const handleAccountChange = useCallback((newPubkey: PublicKey | null) => {
    if (newPubkey) {
      setConnectedWallet(prev => {
        if (!prev) return null;
        const newAddress = newPubkey.toBase58();
        localStorage.setItem(STORAGE_KEY_WALLET_ADDR, newAddress);
        return {
          ...prev,
          publicKey: newPubkey,
          address: newAddress,
        };
      });
    } else {
      // Disconnected
      setConnectedWallet(null);
      setSolBalance(null);
      localStorage.removeItem(STORAGE_KEY_WALLET_NAME);
      localStorage.removeItem(STORAGE_KEY_WALLET_ADDR);
    }
  }, []);

  // Handle Provider Disconnect
  const handleProviderDisconnect = useCallback(() => {
    setConnectedWallet(null);
    setSolBalance(null);
    localStorage.removeItem(STORAGE_KEY_WALLET_NAME);
    localStorage.removeItem(STORAGE_KEY_WALLET_ADDR);
  }, []);

  // Connect Wallet Action
  const connectWallet = useCallback(async (
    walletName: WalletName,
    forceMobileDeepLink: boolean = false
  ): Promise<ConnectedSolanaWallet> => {
    setIsConnecting(true);
    setError(null);

    try {
      const wallet = await connectWalletProvider(walletName, {
        forceMobileDeepLink,
        onAccountChange: handleAccountChange,
        onDisconnect: handleProviderDisconnect,
      });

      setConnectedWallet(wallet);
      localStorage.setItem(STORAGE_KEY_WALLET_NAME, wallet.name);
      localStorage.setItem(STORAGE_KEY_WALLET_ADDR, wallet.address);

      // Fetch balance immediately
      fetchWalletSolBalance(connectionRef.current, wallet.publicKey).then(balance => {
        setSolBalance(balance);
      });

      setWalletModalOpen(false);
      return wallet;
    } catch (err: any) {
      const msg = err?.message || `Failed to connect to ${walletName}.`;
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [handleAccountChange, handleProviderDisconnect]);

  // Disconnect Wallet Action
  const disconnectWallet = useCallback(async () => {
    if (connectedWallet) {
      try {
        await connectedWallet.disconnect();
      } catch (err) {
        // Ignore disconnect errors
      }
    }
    setConnectedWallet(null);
    setSolBalance(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY_WALLET_NAME);
    localStorage.removeItem(STORAGE_KEY_WALLET_ADDR);
    sessionStorage.removeItem('surchi_wallet_session');
    sessionStorage.removeItem('surchi_wallet_dapp_secret');
    sessionStorage.removeItem('surchi_pending_wallet');
  }, [connectedWallet]);

  // Check on mount:
  // 1. Mobile callback from deep link
  // 2. Eager reconnection if previously connected
  useEffect(() => {
    updateAvailableWallets();

    // Check for mobile callback
    try {
      const mobileWalletData = handleMobileConnectCallback();
      if (mobileWalletData) {
        const mobileWallet: ConnectedSolanaWallet = {
          name: mobileWalletData.name,
          publicKey: mobileWalletData.publicKey,
          address: mobileWalletData.address,
          session: mobileWalletData.session,
          isMobileDeepLink: true,
          signTransaction: async (tx) => {
            // If in-app browser has injected provider, prefer it
            const p = mobileWalletData.name === 'Phantom' ? (window?.phantom?.solana || window?.solana) : window?.solflare;
            if (p?.signTransaction) {
              return await p.signTransaction(tx);
            }
            throw new Error(`Please use your ${mobileWalletData.name} mobile app to sign transactions.`);
          },
          disconnect: async () => {
            // Clear mobile state
          }
        };

        setConnectedWallet(mobileWallet);
        localStorage.setItem(STORAGE_KEY_WALLET_NAME, mobileWallet.name);
        localStorage.setItem(STORAGE_KEY_WALLET_ADDR, mobileWallet.address);

        fetchWalletSolBalance(connectionRef.current, mobileWallet.publicKey).then(b => setSolBalance(b));
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'Mobile wallet connection was cancelled or rejected.');
    }

    // Attempt eager silent reconnect on desktop / in-app
    const savedName = localStorage.getItem(STORAGE_KEY_WALLET_NAME) as WalletName | null;
    if (savedName && (savedName === 'Phantom' || savedName === 'Solflare')) {
      connectWalletProvider(savedName, {
        onlyIfTrusted: true,
        onAccountChange: handleAccountChange,
        onDisconnect: handleProviderDisconnect,
      })
        .then(wallet => {
          setConnectedWallet(wallet);
          fetchWalletSolBalance(connectionRef.current, wallet.publicKey).then(b => setSolBalance(b));
        })
        .catch(() => {
          // Trusted auto-connect didn't fire, user can click Connect
        });
    }
  }, [handleAccountChange, handleProviderDisconnect, updateAvailableWallets]);

  // Refresh balance when window gains focus
  useEffect(() => {
    const onFocus = () => {
      if (connectedWallet) {
        refreshBalance();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [connectedWallet, refreshBalance]);

  return (
    <SolanaWalletContext.Provider
      value={{
        connectedWallet,
        shortenedAddress,
        solBalance,
        isConnecting,
        isRefreshingBalance,
        walletModalOpen,
        setWalletModalOpen,
        connectWallet,
        disconnectWallet,
        refreshBalance,
        error,
        clearError,
        availableWallets,
        isMobile,
        network: 'mainnet-beta',
      }}
    >
      {children}
    </SolanaWalletContext.Provider>
  );
};

export function useSolanaWallet(): SolanaWalletContextType {
  const context = useContext(SolanaWalletContext);
  if (!context) {
    throw new Error('useSolanaWallet must be used within a SolanaWalletProvider');
  }
  return context;
}
