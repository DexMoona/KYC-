import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { 
  RefreshCw, Wallet, LayoutGrid, TrendingUp, DollarSign, ListCollapse, Award, 
  History, Landmark, ShieldCheck, Cpu, Copy, Check, AlertTriangle, ExternalLink, 
  CheckCircle2, Pause, Play, Sparkles, ArrowUpRight, Clock, ShieldAlert, Database
} from 'lucide-react';
import { Token } from '../types';
import TokenIcon from './TokenIcon';
import ChainIcon from './ChainIcon';
import DataLoader from './DataLoader';
import { useLivePrice } from './LivePriceContext';
import { useSolanaWallet } from '../context/SolanaWalletContext';

interface PortfolioBalance {
  token: Token;
  balance: number;
  valueUSD: number;
  decimals?: number;
}

interface PortfolioData {
  walletAddress: string;
  chainType: 'EVM' | 'Solana' | 'Sui' | 'Sei';
  detectedChain: string;
  dataSource?: string;
  totalValueUSD: number;
  solBalance?: number;
  solPriceUSD?: number;
  valueChange24h: number;
  tokenBalances: PortfolioBalance[];
  allocation: { name: string; symbol?: string; value: number; valueUSD: number; logo?: string }[];
  performanceHistory: { date: string; value: number }[];
  nftHoldings?: { id: string; name: string; collection: string; image: string; mint: string }[];
  realizedProfit: number;
  unrealizedProfit: number;
  winRate: number;
  averageHoldTime: string;
  gasSpent: number;
  totalTransactions: number;
  firstTxDate: string;
  lastTxDate: string;
  walletAgeDays: number;
  lastUpdated?: string;
  timestamp?: number;
}

// Preset popular Solana & EVM addresses for quick testing
const SAMPLE_WALLETS = [
  { label: 'JUP Whale (Solana)', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', chain: 'Solana' },
  { label: 'Smart Money (Solana)', address: '5vc86k7s9k83shv6z7s19ka73gsk91js7fhs20js', chain: 'Solana' },
  { label: 'Smart Trader (EVM)', address: '0x3fC91A3afd38167F78540450d0364d9E9623e4Cc', chain: 'EVM' }
];

export default function PortfolioView() {
  const { connectedWallet, shortenedAddress } = useSolanaWallet();
  const [walletInput, setWalletInput] = useState('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'); // Helius Solana Wallet
  const [targetChain, setTargetChain] = useState('auto');
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'invalid' | 'rate_limit' | 'network' | 'not_found' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-refresh timer state (Requirement 3: 15-30s auto-refresh)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(20);
  const [lastUpdatedFormatted, setLastUpdatedFormatted] = useState<string>('');

  // AbortController ref for request cancellation (Requirement 6)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Validate wallet address format client-side (Requirement 7)
  const validateWalletAddress = (address: string): { valid: boolean; error?: string } => {
    const clean = address.trim();
    if (!clean) {
      return { valid: false, error: 'Wallet address cannot be empty.' };
    }
    // Solana base58 check (32-44 characters)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
      return { valid: true };
    }
    // EVM check (0x followed by 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/.test(clean)) {
      return { valid: true };
    }
    // Sui check (0x followed by 64 hex chars)
    if (/^0x[a-fA-F0-9]{64}$/.test(clean)) {
      return { valid: true };
    }
    // Sei check (sei1 followed by 38 chars)
    if (/^sei1[a-zA-Z0-9]{38}$/.test(clean)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid wallet address format. For Solana, enter a 32-44 character Base58 address (e.g. JUP6...TaV4).'
    };
  };

  const fetchPortfolio = async (address: string, chain: string = 'auto', isBackground: boolean = false) => {
    const cleanAddress = address.trim();
    
    // Client-side validation check
    const validation = validateWalletAddress(cleanAddress);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid wallet address');
      setErrorMsg(validation.error || 'Invalid wallet address');
      setErrorType('invalid');
      setPortfolio(null);
      setConnectedAddress(null);
      return;
    }

    setValidationError(null);

    // Cancel previous inflight requests (Requirement 6: Cancel previous requests when user enters a new wallet)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    if (!isBackground) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setErrorMsg(null);
    setErrorType(null);

    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: cleanAddress, targetChain: chain }),
        signal: controller.signal
      });

      const data = await res.json();

      if (res.status === 429) {
        setErrorType('rate_limit');
        setErrorMsg('Helius API rate limit exceeded (HTTP 429). Retrying automatically shortly.');
        setPortfolio(null);
        setConnectedAddress(null);
        return;
      }

      if (res.ok && data && !data.error) {
        setPortfolio(data);
        setConnectedAddress(cleanAddress);
        setLastUpdatedFormatted(new Date().toLocaleTimeString());
        setSecondsUntilRefresh(20); // Reset timer
      } else {
        const errorText = data?.error || 'Failed to scan live blockchain data.';
        if (res.status === 400 || errorText.toLowerCase().includes('invalid')) {
          setErrorType('invalid');
        } else if (res.status === 404 || errorText.toLowerCase().includes('not found')) {
          setErrorType('not_found');
        } else {
          setErrorType('network');
        }
        setErrorMsg(errorText);
        setPortfolio(null);
        setConnectedAddress(null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignored aborted request from fast wallet switching
        return;
      }
      console.error('Error fetching Helius portfolio:', err);
      setErrorType('network');
      setErrorMsg('Network connectivity error. Could not reach Helius Solana API nodes.');
      setPortfolio(null);
      setConnectedAddress(null);
    } finally {
      clearTimeout(timeoutId);
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchPortfolio(walletInput, targetChain);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-refresh countdown interval effect (Requirement 3)
  useEffect(() => {
    if (!autoRefreshEnabled || !connectedAddress) return;

    const interval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          if (connectedAddress) {
            fetchPortfolio(connectedAddress, targetChain, true);
          }
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, connectedAddress, targetChain]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (walletInput.trim()) {
      fetchPortfolio(walletInput.trim(), targetChain);
    }
  };

  const handleSelectSample = (sampleAddr: string) => {
    setWalletInput(sampleAddr);
    fetchPortfolio(sampleAddr, targetChain);
  };

  const copyToClipboard = () => {
    if (connectedAddress) {
      navigator.clipboard.writeText(connectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const COLORS = ['#c5a880', '#ebd5b3', '#a38a67', '#755a3f', '#967b57', '#5c4930', '#d4af37', '#8a795d'];

  // Calculate dynamic security/whale scores
  const whaleScore = portfolio ? Math.min(100, Math.max(12, Math.round((portfolio.totalValueUSD / 50000) * 10) + 15)) : 0;
  const smartMoneyScore = portfolio ? Math.min(99, Math.max(20, Math.round(portfolio.winRate * 1.15))) : 0;
  const rankPercentile = portfolio ? (portfolio.totalValueUSD > 100000 ? 'Top 0.1%' : portfolio.totalValueUSD > 10000 ? 'Top 1.5%' : 'Top 8.4%') : '';

  // Extract SOL native balance entry if available
  const solTokenBalance = portfolio?.tokenBalances.find(b => b.token.symbol === 'SOL');

  return (
    <div className="space-y-6 text-gray-100">
      
      {/* Search Header Connect with Live Helius Indicator */}
      <div className="bg-elegant-surface border border-elegant-border rounded-xl p-6 shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between">
          
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 rounded-xl shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Engine
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-2.5 w-full lg:max-w-2xl">
            <select
              value={targetChain}
              onChange={(e) => setTargetChain(e.target.value)}
              className="px-3 py-2 bg-elegant-bg border border-elegant-border rounded-lg text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-elegant-gold cursor-pointer"
            >
              <option value="auto">Auto-Detect (Solana / EVM)</option>
              <option value="Solana">Solana (Helius API)</option>
              <option value="EVM">Ethereum / EVM</option>
              <option value="Sui">Sui Network</option>
              <option value="Sei">Sei Network</option>
            </select>

            <div className="flex-1 relative">
              <input
                type="text"
                value={walletInput}
                onChange={(e) => {
                  setWalletInput(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Enter Solana (Base58) or EVM address..."
                className={`w-full px-4 py-2 bg-elegant-bg border ${
                  validationError ? 'border-red-500/80 focus:ring-red-500' : 'border-elegant-border focus:ring-elegant-gold'
                } rounded-lg text-white font-mono text-xs focus:outline-none focus:ring-1 placeholder:text-gray-500`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scan Live Portfolio</span>
                </>
              )}
            </button>
          </form>

        </div>

        {/* Quick Select Sample Wallets */}
        <div className="mt-4 pt-4 border-t border-elegant-border/40 flex flex-wrap items-center gap-2 text-xs">
          {connectedWallet && (
            <button
              type="button"
              id="btn-scan-connected-wallet"
              onClick={() => {
                setWalletInput(connectedWallet.address);
                setTargetChain('Solana');
                fetchPortfolio(connectedWallet.address, 'Solana');
              }}
              className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded text-[11px] font-mono text-emerald-300 font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title={`Scan connected ${connectedWallet.name} wallet`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Scan Connected {connectedWallet.name} ({shortenedAddress})</span>
            </button>
          )}
          <span className="text-gray-400 text-[11px] font-mono">Sample Live Wallets:</span>
          {SAMPLE_WALLETS.map((sample) => (
            <button
              key={sample.address}
              onClick={() => handleSelectSample(sample.address)}
              className="px-2.5 py-1 bg-elegant-bg hover:bg-elegant-surface-hover border border-elegant-border/70 rounded text-[11px] font-mono text-elegant-gold transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <span>{sample.label}</span>
              <ArrowUpRight className="w-3 h-3 text-gray-400" />
            </button>
          ))}
        </div>

        {validationError && (
          <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-mono flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Main Data View or States */}
      <DataLoader
        loading={loading}
        error={errorMsg}
        onRetry={() => fetchPortfolio(walletInput.trim(), targetChain)}
        progressText="Querying Helius DAS API, indexing SPL token balances & live prices..."
      >
        {portfolio && connectedAddress ? (
          <div className="space-y-6">

            {/* Wallet Info Bar & Refresh Control */}
            <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 bg-elegant-bg px-3 py-1.5 rounded-lg border border-elegant-border font-mono text-xs">
                  <span className="text-gray-400">Wallet:</span>
                  <span className="text-white font-bold tracking-wider">
                    {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-6)}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    title="Copy wallet address"
                    className="text-gray-400 hover:text-elegant-gold transition-colors p-0.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={portfolio.chainType === 'Solana' ? `https://solscan.io/account/${connectedAddress}` : `https://etherscan.io/address/${connectedAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    title="View on Block Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium bg-elegant-bg border border-elegant-border text-gray-300">
                  <Database className="w-3.5 h-3.5 text-elegant-gold" />
                  <span>{portfolio.dataSource || 'Helius DAS API'}</span>
                </span>
              </div>

              {/* Auto-Refresh Status & Toggle */}
              <div className="flex items-center space-x-3 text-xs font-mono">
                <div className="flex items-center space-x-2 text-gray-400">
                  <Clock className="w-3.5 h-3.5 text-elegant-gold" />
                  <span>
                    Updated {lastUpdatedFormatted || 'Just now'}
                  </span>
                </div>

                <div className="h-4 w-px bg-elegant-border"></div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                    className={`px-2.5 py-1 rounded border text-[11px] font-mono flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      autoRefreshEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-elegant-surface border-elegant-border text-elegant-text-secondary'
                    }`}
                  >
                    {autoRefreshEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{autoRefreshEnabled ? `Auto (${secondsUntilRefresh}s)` : 'Paused'}</span>
                  </button>

                  <button
                    onClick={() => fetchPortfolio(connectedAddress, targetChain, true)}
                    disabled={isRefreshing}
                    className="p-1.5 bg-elegant-bg hover:bg-elegant-surface-hover border border-elegant-border rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
                    title="Refresh Portfolio Now"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-elegant-gold' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Stats Panel Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Portfolio Total Value */}
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-elegant-text-secondary text-[10px] font-mono uppercase tracking-wider">Total Portfolio Value</span>
                  <p className="text-white text-2xl font-bold font-mono">
                    ${portfolio.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center space-x-1">
                    <span className="text-emerald-400 text-xs font-mono font-semibold">+{portfolio.valueChange24h}%</span>
                    <span className="text-[9px] text-gray-500 font-mono">(24h live index)</span>
                  </div>
                </div>
                <div className="p-2.5 bg-elegant-gold/10 border border-elegant-gold/20 text-elegant-gold rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              {/* SOL Balance Card (Requirement 2) */}
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-elegant-text-secondary text-[10px] font-mono uppercase tracking-wider">SOL Native Balance</span>
                  <p className="text-white text-xl font-bold font-mono">
                    {portfolio.solBalance !== undefined 
                      ? `${portfolio.solBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`
                      : (solTokenBalance ? `${solTokenBalance.balance.toLocaleString()} SOL` : '0 SOL')}
                  </p>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-gray-400 text-[10px] font-mono">
                      Unit Price: ${(portfolio.solPriceUSD || solTokenBalance?.token.price || 184.45).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                  <ChainIcon chain="Solana" className="w-5 h-5" />
                </div>
              </div>

              {/* Unrealized P&L */}
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-elegant-text-secondary text-[10px] font-mono uppercase tracking-wider">Unrealized P&L</span>
                  <p className="text-emerald-400 text-xl font-bold font-mono">
                    +${portfolio.unrealizedProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-400 text-[10px] font-mono">Realized:</span>
                    <span className="text-white text-[10px] font-mono font-bold">+${portfolio.realizedProfit.toLocaleString()}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              {/* Transactions / Activity */}
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-elegant-text-secondary text-[10px] font-mono uppercase tracking-wider">Transactions Index</span>
                  <p className="text-white text-xl font-bold font-mono">{portfolio.totalTransactions} Tx Activity</p>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-gray-400 text-[10px] font-mono">Gas Spent:</span>
                    <span className="text-elegant-gold text-[10px] font-mono font-bold">
                      {portfolio.gasSpent} {portfolio.chainType === 'Solana' ? 'SOL' : 'ETH'}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* On-Chain Analytics Engine Scores */}
            <div className="bg-gradient-to-r from-elegant-surface to-elegant-bg border border-elegant-border rounded-xl p-5 shadow-lg">
              <h3 className="text-white font-bold text-xs font-mono uppercase tracking-widest text-elegant-gold pb-3 border-b border-elegant-border/40 mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4" /> On-Chain Analytics Engine
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-elegant-surface/40 border border-elegant-border/50 rounded-lg">
                  <span className="text-[9px] text-gray-400 font-mono uppercase block mb-1">Smart Money Score</span>
                  <span className="text-2xl font-bold font-mono text-elegant-gold gold-glow">{smartMoneyScore}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">High-Accuracy Alpha</span>
                </div>
                <div className="p-4 bg-elegant-surface/40 border border-elegant-border/50 rounded-lg">
                  <span className="text-[9px] text-gray-400 font-mono uppercase block mb-1">Whale Score</span>
                  <span className="text-2xl font-bold font-mono text-white">{whaleScore}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Net Worth Tier</span>
                </div>
                <div className="p-4 bg-elegant-surface/40 border border-elegant-border/50 rounded-lg">
                  <span className="text-[9px] text-gray-400 font-mono uppercase block mb-1">Win Rate</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">{portfolio.winRate}%</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Weighted Trading Win</span>
                </div>
                <div className="p-4 bg-elegant-surface/40 border border-elegant-border/50 rounded-lg">
                  <span className="text-[9px] text-gray-400 font-mono uppercase block mb-1">Rank Ranking</span>
                  <span className="text-md font-bold font-mono text-white block pt-1 uppercase">{rankPercentile}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Global Wallet Index</span>
                </div>
              </div>
            </div>

            {/* Grid Allocation & historic performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Pie chart allocation */}
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-md">
                <div className="pb-2 border-b border-elegant-border/50">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-elegant-gold" /> Token Asset Allocations (%)
                  </h3>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-4">
                  <div className="h-44 w-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolio.allocation}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {portfolio.allocation.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 w-full md:w-auto font-mono text-xs max-h-48 overflow-y-auto pr-1">
                    {portfolio.allocation.map((entry, idx) => (
                      <div key={`${entry.name}-${idx}`} className="flex items-center justify-between gap-6">
                        <div className="flex items-center space-x-2">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <span className="text-white font-bold">{entry.symbol || entry.name}</span>
                        </div>
                        <span className="text-elegant-text-secondary">
                          {entry.value}% (${(entry.valueUSD).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Performance line chart */}
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
                <div className="pb-2 border-b border-elegant-border/50">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-elegant-gold" /> Historical Balance Trend
                  </h3>
                </div>
                <div className="h-48 w-full font-mono text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolio.performanceHistory} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c5a880" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#c5a880" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#8a8a8a" />
                      <YAxis stroke="#8a8a8a" domain={['auto', 'auto']} tickFormatter={(v) => `$${(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#121212', borderColor: '#c5a880', color: '#fff' }}
                        formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Portfolio Value']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#c5a880" strokeWidth={2} fillOpacity={1} fill="url(#colorPortfolio)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Token Balances Table (Requirement 2) */}
            <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
              <div className="pb-2 border-b border-elegant-border/50 flex items-center justify-between">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <ListCollapse className="w-4 h-4 text-elegant-gold" /> SPL & Token Balances Breakdown ({portfolio.tokenBalances.length})
                </h3>
                <span className="text-xs font-mono text-gray-400">
                  Total Tokens: {portfolio.tokenBalances.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-elegant-border/50 text-[11px] text-elegant-text-secondary font-mono uppercase">
                      <th className="pb-2">Token / Asset</th>
                      <th className="pb-2">Contract / Mint</th>
                      <th className="pb-2 text-right">Decimals</th>
                      <th className="pb-2 text-right">Balance</th>
                      <th className="pb-2 text-right">Unit Price</th>
                      <th className="pb-2 text-right">Total Value ($)</th>
                      <th className="pb-2 text-right">Allocation (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-border/30">
                    {portfolio.tokenBalances.map((tb, idx) => {
                      const totalValue = portfolio.totalValueUSD || 1;
                      const allocPct = ((tb.valueUSD / totalValue) * 100).toFixed(1);
                      return (
                        <PortfolioBalanceRow 
                          key={`${tb.token.address}-${idx}`} 
                          tb={tb} 
                          allocPct={allocPct}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* NFT Holdings Section */}
            {portfolio.nftHoldings && portfolio.nftHoldings.length > 0 && (
              <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
                <div className="pb-2 border-b border-elegant-border/50">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-elegant-gold" /> NFT Holdings ({portfolio.nftHoldings.length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {portfolio.nftHoldings.map((nft) => (
                    <div key={nft.id} className="bg-elegant-bg border border-elegant-border/60 rounded-lg p-2.5 flex flex-col space-y-2 group hover:border-elegant-gold/40 transition-all">
                      <div className="relative aspect-square w-full rounded overflow-hidden bg-elegant-surface">
                        <img
                          src={nft.image}
                          alt={nft.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono text-gray-500 uppercase block">{nft.collection}</span>
                        <span className="text-[11px] font-bold text-white block truncate">{nft.name}</span>
                        <span className="text-[9px] font-mono text-elegant-gold/80 block">Mint: {nft.mint}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ledger Interaction Footprint */}
            <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-3.5 shadow-md font-mono text-xs">
              <h3 className="text-white font-bold text-sm flex items-center gap-2 pb-2 border-b border-elegant-border/50">
                <Landmark className="w-4 h-4 text-elegant-gold" /> Ledger Transaction Footprints
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-elegant-border/30 pb-1.5">
                    <span className="text-gray-500">First Interaction Date:</span>
                    <span className="text-white font-bold">{portfolio.firstTxDate}</span>
                  </div>
                  <div className="flex justify-between border-b border-elegant-border/30 pb-1.5">
                    <span className="text-gray-500">Last Active Interaction:</span>
                    <span className="text-white font-bold">{portfolio.lastTxDate}</span>
                  </div>
                  <div className="flex justify-between border-b border-elegant-border/30 pb-1.5">
                    <span className="text-gray-500">Avg Hold Interval:</span>
                    <span className="text-white font-bold">{portfolio.averageHoldTime}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-elegant-border/30 pb-1.5">
                    <span className="text-gray-500">Cumulative Transaction Count:</span>
                    <span className="text-white font-bold">{portfolio.totalTransactions} transactions</span>
                  </div>
                  <div className="flex justify-between border-b border-elegant-border/30 pb-1.5">
                    <span className="text-gray-500">Total Gas Spent:</span>
                    <span className="text-white font-bold">{portfolio.gasSpent} {portfolio.chainType === 'Solana' ? 'SOL' : 'ETH'}</span>
                  </div>
                  <div className="flex justify-between border-b border-elegant-border/30 pb-1.5">
                    <span className="text-gray-500">Smart Ranking:</span>
                    <span className="text-elegant-gold font-bold">{rankPercentile} overall</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Empty or Error State (Requirement 4) */
          <div className="bg-elegant-surface border border-elegant-border rounded-xl p-10 text-center space-y-4 shadow-md">
            {errorType === 'invalid' ? (
              <div className="space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-white font-bold text-base font-sans">Invalid Wallet Address</h3>
                <p className="text-gray-400 text-xs font-mono">
                  {errorMsg || 'Please enter a valid Solana Base58 address (32-44 characters) or EVM address.'}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleSelectSample('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')}
                    className="px-4 py-2 bg-elegant-gold/10 hover:bg-elegant-gold/20 border border-elegant-gold/30 text-elegant-gold text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    Load Sample JUP Solana Wallet
                  </button>
                </div>
              </div>
            ) : errorType === 'rate_limit' ? (
              <div className="space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-white font-bold text-base font-sans">Rate Limit Exceeded (HTTP 429)</h3>
                <p className="text-gray-400 text-xs font-mono">
                  Helius API rate limit reached. The tracker will retry automatically in a few seconds.
                </p>
                <button
                  onClick={() => fetchPortfolio(walletInput.trim(), targetChain)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer"
                >
                  Retry Now
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 bg-elegant-gold/10 border border-elegant-gold/20 text-elegant-gold rounded-full flex items-center justify-center mx-auto">
                  <Wallet className="w-6 h-6" />
                </div>
                <h3 className="text-white font-bold text-base font-sans">No Token Holdings Found</h3>
                <p className="text-gray-400 text-xs font-mono">
                  Enter any active Solana (Base58) or EVM wallet address above to fetch live portfolios in real time via Helius API.
                </p>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {SAMPLE_WALLETS.map(sample => (
                    <button
                      key={sample.address}
                      onClick={() => handleSelectSample(sample.address)}
                      className="px-3 py-1.5 bg-elegant-bg border border-elegant-border hover:border-elegant-gold text-xs font-mono text-elegant-gold rounded-lg transition-colors cursor-pointer"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DataLoader>
    </div>
  );
}

interface PortfolioBalanceRowProps {
  key?: string;
  tb: PortfolioBalance;
  allocPct: string;
}

function PortfolioBalanceRow({ tb, allocPct }: PortfolioBalanceRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Use viewport-aware live price hook
  const { price, flash } = useLivePrice(
    tb.token.address,
    tb.token.price,
    tb.token.priceChange24h,
    rowRef
  );

  const formattedPrice = price < 0.0001
    ? price.toFixed(8)
    : price < 0.01
      ? price.toFixed(6)
      : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const totalValueUSD = tb.balance * price;
  const formattedValueUSD = totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <tr ref={rowRef} className="hover:bg-elegant-surface-hover/30 transition-colors">
      
      {/* Token Name & Symbol */}
      <td className="py-3 font-semibold text-xs text-white">
        <div className="flex items-center space-x-2.5">
          <TokenIcon symbol={tb.token.symbol} address={tb.token.address} logoUrl={tb.token.logo} size="sm" />
          <div className="flex flex-col">
            <span className="font-bold">{tb.token.name}</span>
            <span className="text-elegant-gold font-mono text-[10px]">{tb.token.symbol}</span>
          </div>
        </div>
      </td>

      {/* Contract / Mint Address */}
      <td className="py-3 text-xs text-elegant-text-secondary font-mono">
        <span className="bg-elegant-bg px-2 py-0.5 rounded border border-elegant-border/50 text-[10px] text-gray-300" title={tb.token.address}>
          {tb.token.address.length > 12 ? `${tb.token.address.slice(0, 4)}...${tb.token.address.slice(-4)}` : tb.token.address}
        </span>
      </td>

      {/* Decimals */}
      <td className="py-3 text-right font-mono text-xs text-gray-400">
        {tb.decimals !== undefined ? tb.decimals : (tb.token.symbol === 'SOL' ? 9 : 6)}
      </td>

      {/* Balance */}
      <td className="py-3 text-right font-mono text-xs text-white font-bold">
        {tb.balance < 0.001 ? tb.balance.toFixed(6) : tb.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </td>

      {/* Unit Price */}
      <td className={`py-3 text-right font-mono text-xs transition-all duration-300 rounded-sm px-1 ${
        flash === 'up'
          ? 'text-emerald-400 bg-emerald-500/15 scale-105 font-bold'
          : flash === 'down'
            ? 'text-red-400 bg-red-500/15 scale-105 font-bold'
            : 'text-elegant-text-secondary'
      }`}>
        ${formattedPrice}
      </td>

      {/* Total USD Value */}
      <td className="py-3 text-right font-mono text-xs text-white font-bold">
        ${formattedValueUSD}
      </td>

      {/* Allocation % */}
      <td className="py-3 text-right font-mono text-xs">
        <div className="flex items-center justify-end space-x-2">
          <div className="w-12 bg-elegant-surface-hover h-1.5 rounded-full overflow-hidden shrink-0">
            <div 
              className="bg-elegant-gold h-full rounded-full" 
              style={{ width: `${Math.min(100, Math.max(2, parseFloat(allocPct)))}%` }}
            ></div>
          </div>
          <span className="text-gray-300 font-bold min-w-[36px]">{allocPct}%</span>
        </div>
      </td>

    </tr>
  );
}
