import React, { useState } from 'react';
import {
  Wallet,
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Sparkles
} from 'lucide-react';
import { useSolanaWallet } from '../context/SolanaWalletContext';
import {
  getSolscanAddressUrl,
  WalletName
} from '../utils/solanaWallet';

interface WalletModalProps {
  onConnected?: () => void;
}

export default function WalletModal({ onConnected }: WalletModalProps = {}) {
  const {
    connectedWallet,
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
  } = useSolanaWallet();

  const [copied, setCopied] = useState(false);
  const [selectedWalletPending, setSelectedWalletPending] = useState<WalletName | null>(null);

  if (!walletModalOpen) return null;

  const handleConnect = async (walletName: WalletName) => {
    setSelectedWalletPending(walletName);
    try {
      await connectWallet(walletName);
      setWalletModalOpen(false);
      onConnected?.();
    } catch (err) {
      // Error handled in context
    } finally {
      setSelectedWalletPending(null);
    }
  };

  const copyAddress = () => {
    if (!connectedWallet) return;
    navigator.clipboard.writeText(connectedWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="solana-wallet-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) {
          clearError();
          setWalletModalOpen(false);
        }
      }}
    >
      <div
        id="solana-wallet-modal-card"
        className="bg-elegant-surface border border-elegant-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          id="btn-close-wallet-modal"
          onClick={() => {
            clearError();
            setWalletModalOpen(false);
          }}
          disabled={isConnecting}
          className="absolute top-4 right-4 text-elegant-text-secondary hover:text-white transition-colors cursor-pointer disabled:opacity-30 p-1"
          title="Close wallet modal"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-elegant-gold/10 border border-elegant-gold/30 flex items-center justify-center text-elegant-gold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {connectedWallet ? 'Solana Wallet Connected' : 'Connect Solana Wallet'}
              </h3>
              <div className="flex items-center space-x-1.5 text-[11px] font-mono text-elegant-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Solana Mainnet-Beta</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONNECTED STATE VIEW */}
        {connectedWallet ? (
          <div className="space-y-4 pt-1">
            <div className="bg-elegant-bg/80 border border-elegant-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <img
                    src={connectedWallet.name === 'Phantom' ? '/wallets/phantom.svg' : '/wallets/solflare.svg'}
                    alt={connectedWallet.name}
                    className="w-7 h-7 rounded-lg"
                  />
                  <div>
                    <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <span>{connectedWallet.name}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-elegant-text-secondary">
                      {isMobile ? 'Mobile Wallet Session' : 'Browser Extension'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-refresh-wallet-balance"
                  onClick={refreshBalance}
                  disabled={isRefreshingBalance}
                  className="p-1.5 text-elegant-text-secondary hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  title="Refresh SOL Balance"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingBalance ? 'animate-spin text-elegant-gold' : ''}`} />
                </button>
              </div>

              {/* Public Address Box */}
              <div className="p-2.5 bg-black/40 rounded-lg border border-elegant-border/60 flex items-center justify-between gap-2 font-mono text-xs">
                <div className="truncate text-slate-200 select-all">
                  {connectedWallet.address}
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    id="btn-copy-connected-address"
                    onClick={copyAddress}
                    className="p-1 text-elegant-text-secondary hover:text-elegant-gold transition-colors cursor-pointer"
                    title="Copy Address"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={getSolscanAddressUrl(connectedWallet.address, 'mainnet-beta')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-elegant-text-secondary hover:text-white transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Balance Box */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-elegant-text-secondary font-mono">SOL Balance:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : 'Loading...'}
                </span>
              </div>
            </div>

            {/* Actions: Disconnect button */}
            <div className="flex space-x-3 pt-1">
              <button
                type="button"
                id="btn-disconnect-wallet"
                onClick={async () => {
                  await disconnectWallet();
                  setWalletModalOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect Wallet</span>
              </button>

              <button
                type="button"
                id="btn-close-connected-modal"
                onClick={() => {
                  setWalletModalOpen(false);
                  onConnected?.();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <span>Token Creator Panel</span>
              </button>
            </div>
          </div>
        ) : (
          /* DISCONNECTED / CONNECT SELECTION VIEW */
          <div className="space-y-4 pt-1">
            <p className="text-xs text-elegant-text-secondary leading-relaxed">
              Select your preferred Solana wallet to authenticate and sign the SPL token creation transaction.
            </p>

            {/* Error / Cancellation Message Box */}
            {error && (
              <div
                id="wallet-connect-error-banner"
                className={`p-3 rounded-xl text-xs font-mono flex items-start space-x-2.5 animate-fade-in ${
                  error === 'Connection cancelled'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                  error === 'Connection cancelled' ? 'text-amber-400' : 'text-red-400'
                }`} />
                <div className="flex-1 space-y-1">
                  <div className="font-bold">
                    {error === 'Connection cancelled' ? 'Connection Cancelled' : 'Connection Failed'}
                  </div>
                  <div className="text-[11px] leading-relaxed opacity-90">{error}</div>
                </div>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-white/60 hover:text-white text-xs cursor-pointer p-0.5"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Wallet Selection List */}
            <div className="space-y-2.5 font-mono">
              {availableWallets.map((wallet) => {
                const isSelectedPending = isConnecting && selectedWalletPending === wallet.name;

                return (
                  <div
                    key={wallet.name}
                    onClick={() => !isConnecting && handleConnect(wallet.name)}
                    className="border border-elegant-border hover:border-elegant-gold/50 rounded-xl bg-elegant-bg/60 hover:bg-elegant-surface/80 transition-all overflow-hidden cursor-pointer group"
                  >
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          className="w-9 h-9 rounded-xl object-contain bg-black/40 p-1 shrink-0 group-hover:scale-105 transition-transform"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-white text-sm flex items-center space-x-2">
                            <span>{wallet.name}</span>
                            {wallet.installed && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold uppercase">
                                Detected
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-elegant-text-secondary truncate">
                            {isMobile
                              ? 'Official Universal Link connection'
                              : wallet.installed
                              ? 'Solana browser extension ready'
                              : 'Solana wallet'}
                          </div>
                        </div>
                      </div>

                      {/* Direct Connect Button */}
                      <button
                        type="button"
                        id={`btn-connect-${wallet.name.toLowerCase()}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnect(wallet.name);
                        }}
                        disabled={isConnecting}
                        className="py-2 px-3.5 rounded-lg bg-elegant-gold hover:bg-elegant-gold-hover disabled:opacity-50 text-elegant-bg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 shadow-sm"
                      >
                        {isSelectedPending ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <span>Connect</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Connecting Spinner Note */}
            {isConnecting && (
              <div className="p-3 bg-elegant-gold/10 border border-elegant-gold/30 rounded-xl text-elegant-gold text-xs font-mono flex items-center space-x-2.5">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>
                  Please approve the connection in your {selectedWalletPending || 'Solana'} wallet.
                </span>
              </div>
            )}

            {/* Security Guarantee Banner */}
            <div className="bg-elegant-bg p-3 rounded-xl border border-elegant-border text-[11px] font-mono text-elegant-text-secondary flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Key Disclosure:</strong> SURCHI interacts directly with official wallet extensions and deep links. Your seed phrase and private keys are never requested or stored.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
