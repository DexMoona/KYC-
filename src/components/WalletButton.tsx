import React from 'react';
import { Wallet, RefreshCw } from 'lucide-react';
import { useSolanaWallet } from '../context/SolanaWalletContext';

interface WalletButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'compact' | 'prominent';
}

export default function WalletButton({
  className = '',
  variant = 'header',
}: WalletButtonProps) {
  const {
    connectedWallet,
    shortenedAddress,
    solBalance,
    isConnecting,
    setWalletModalOpen,
  } = useSolanaWallet();

  if (connectedWallet) {
    if (variant === 'compact') {
      return (
        <button
          type="button"
          id="btn-wallet-compact"
          onClick={() => setWalletModalOpen(true)}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-elegant-surface border border-elegant-gold/40 hover:border-elegant-gold text-xs font-mono transition-all cursor-pointer ${className}`}
          title={`Connected: ${connectedWallet.address}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-bold text-white text-[11px]">{shortenedAddress}</span>
        </button>
      );
    }

    if (variant === 'sidebar') {
      return (
        <div
          id="sidebar-wallet-card"
          className={`p-3 rounded-xl bg-elegant-surface-hover/80 border border-elegant-border space-y-2 font-mono ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="text-xs font-bold text-white truncate">{shortenedAddress}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-elegant-gold bg-elegant-gold/10 px-1.5 py-0.5 rounded border border-elegant-gold/20">
              {connectedWallet.name}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-elegant-text-secondary pt-0.5">
            <span>Balance:</span>
            <span className="text-white font-bold">
              {solBalance !== null ? `${solBalance.toFixed(3)} SOL` : '...'}
            </span>
          </div>

          <button
            type="button"
            id="btn-sidebar-manage-wallet"
            onClick={() => setWalletModalOpen(true)}
            className="w-full py-1.5 text-center text-[10px] uppercase tracking-wider font-bold text-elegant-text-secondary hover:text-white bg-elegant-bg hover:bg-black/60 rounded-lg border border-elegant-border transition-colors cursor-pointer"
          >
            Manage Wallet
          </button>
        </div>
      );
    }

    // Default header / prominent
    return (
      <button
        type="button"
        id="btn-wallet-header"
        onClick={() => setWalletModalOpen(true)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-gold/40 hover:border-elegant-gold text-xs font-mono transition-all cursor-pointer group shadow-sm ${className}`}
        title={`Connected to ${connectedWallet.name} (${connectedWallet.address})`}
      >
        <div className="flex items-center space-x-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <img
            src={connectedWallet.name === 'Phantom' ? '/wallets/phantom.svg' : '/wallets/solflare.svg'}
            alt={connectedWallet.name}
            className="w-4 h-4 rounded"
          />
          <span className="font-bold text-white group-hover:text-elegant-gold transition-colors">
            {shortenedAddress}
          </span>
        </div>

        {solBalance !== null && (
          <>
            <span className="text-elegant-border">|</span>
            <span className="text-elegant-text-secondary font-medium">
              {solBalance.toFixed(2)} SOL
            </span>
          </>
        )}
      </button>
    );
  }

  // Disconnected state
  return (
    <button
      type="button"
      id="btn-connect-solana-wallet"
      onClick={() => setWalletModalOpen(true)}
      disabled={isConnecting}
      className={`flex items-center justify-center space-x-2 px-3.5 py-1.5 rounded-lg bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-bold font-mono text-xs uppercase tracking-wider transition-all shadow-md shadow-elegant-gold/15 cursor-pointer disabled:opacity-50 ${className}`}
    >
      {isConnecting ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <Wallet className="w-3.5 h-3.5 shrink-0" />
          <span>Connect Wallet</span>
        </>
      )}
    </button>
  );
}
