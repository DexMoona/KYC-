import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  Users, 
  Flame, 
  Coins, 
  Sparkles, 
  Code, 
  FileText,
  Clock,
  Database,
  ArrowRight
} from 'lucide-react';

interface SolanaTokenMeta {
  mint: string;
  name: string;
  symbol: string;
  logo: string;
  totalSupply: number;
  decimals: number;
  priceUSD: number;
  marketCapUSD: number;
  liquidityUSD: number;
  creator: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  mutableMetadata: boolean;
  updateAuthority: string | null;
  metadataUri: string;
  holderCount: number;
  detectedAt: string | null;
}

interface SecurityCheckItem {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details: string;
}

interface RiskVector {
  name: string;
  value?: string;
  description: string;
  score: number;
  level: 'info' | 'warn' | 'danger';
}

interface TopHolder {
  address: string;
  pct: number;
  amount: number;
  insider?: boolean;
}

interface MarketPool {
  dex: string;
  pairAddress: string;
  liquidityUSD: number;
  lpLockedPct: number;
}

interface SolanaAuditReport {
  token: SolanaTokenMeta;
  security: {
    overallScore: number;
    riskLevel: 'Safe' | 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical';
    auditResult: 'VERIFIED SECURE' | 'LOW RISK' | 'CAUTION ADVISED' | 'HIGH RUG RISK' | 'CRITICAL THREAT';
    recommendation: string;
    rugged: boolean;
    risks: RiskVector[];
    checks: {
      mintAuthority: SecurityCheckItem;
      freezeAuthority: SecurityCheckItem;
      liquidityStatus: SecurityCheckItem;
      lpLockStatus: SecurityCheckItem;
      topHolderConcentration: SecurityCheckItem;
      ownershipPattern: SecurityCheckItem;
      metadataSecurity: SecurityCheckItem;
      honeypotCheck: SecurityCheckItem;
    };
    topHolders: TopHolder[];
    markets: MarketPool[];
  };
  cached: boolean;
  cachedAt: string;
  dataSource: string;
}

interface AuditorViewProps {
  onBackToEcosystem?: () => void;
  onSelectToken?: (tokenAddress: string) => void;
}

const POPULAR_SOLANA_TOKENS = [
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcJM' },
  { symbol: 'POPCAT', name: 'Popcat', mint: '7GCihgB12LwyLWr4R45awNG2Za6Hvge3A45C3612wrpt' },
  { symbol: 'PYTH', name: 'Pyth', mint: 'HZ1Jov3yDh2GJLwJJchP3nC4EMM4vEw665y5vE5e1E1E' },
];

export default function AuditorView({ onBackToEcosystem, onSelectToken }: AuditorViewProps) {
  const [inputMint, setInputMint] = useState('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  const [activeMint, setActiveMint] = useState('');
  const [report, setReport] = useState<SolanaAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Scan progress state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  // Validate Base58 on change
  useEffect(() => {
    const trimmed = inputMint.trim();
    if (!trimmed) {
      setValidationError(null);
      return;
    }
    const isSolanaBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
    if (!isSolanaBase58) {
      setValidationError('Invalid Solana mint address format. Must be a 32-44 character Base58 string.');
    } else {
      setValidationError(null);
    }
  }, [inputMint]);

  // Initial load default audit
  useEffect(() => {
    handleRunAudit('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunAudit = async (mintToAudit?: string, forceRefresh: boolean = false) => {
    const targetMint = (mintToAudit || inputMint).trim();
    if (!targetMint) {
      setError('Please enter a Solana token mint address.');
      return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(targetMint)) {
      setError('Invalid Solana token mint address format.');
      return;
    }

    setError(null);
    setActiveMint(targetMint);

    if (forceRefresh) {
      setRefreshing(true);
    }

    try {
      setLoading(true);
      const url = `/api/auditor/solana/${targetMint}${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Failed to complete security audit.' }));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const data: SolanaAuditReport = await res.json();
      setReport(data);
    } catch (err: any) {
      console.error('[AuditorView] Security audit failed:', err);
      setError(err.message || 'An error occurred while analyzing the token contract.');
    } finally {
      setIsScanning(false);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatNumber = (num: number, isCurrency = false) => {
    if (num === undefined || num === null || isNaN(num)) return '$0.00';
    if (isCurrency) {
      if (num < 0.00001) return `$${num.toFixed(8)}`;
      if (num < 0.01) return `$${num.toFixed(6)}`;
      if (num < 1) return `$${num.toFixed(4)}`;
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const getResultBadgeStyle = (result?: string) => {
    switch (result) {
      case 'VERIFIED SECURE':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
      case 'LOW RISK':
        return 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400';
      case 'CAUTION ADVISED':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400';
      case 'HIGH RUG RISK':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400';
      case 'CRITICAL THREAT':
        return 'bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400';
    }
  };

  const renderCheckIcon = (status: 'pass' | 'warn' | 'fail') => {
    if (status === 'pass') {
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
          <Check className="w-4 h-4 stroke-[3]" />
        </div>
      );
    }
    if (status === 'warn') {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
        <XCircle className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-elegant-bg text-elegant-text-primary p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-elegant-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-elegant-gold font-semibold text-xs tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4" />
            Solana On-Chain Security
          </div>
        </div>

        {onBackToEcosystem && (
          <button
            onClick={onBackToEcosystem}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-elegant-surface border border-elegant-border hover:bg-elegant-surface-hover text-white transition-colors self-start md:self-auto"
          >
            ← Back to Dashboard
          </button>
        )}
      </div>

      {/* Search Input Section */}
      <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-5 shadow-sm space-y-4">
        <label className="block text-sm font-medium text-elegant-text-primary">
          Enter Solana Token Mint Address
        </label>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-elegant-text-secondary" />
            <input
              type="text"
              value={inputMint}
              onChange={(e) => setInputMint(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunAudit(inputMint)}
              placeholder="e.g. DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
              className="w-full pl-11 pr-4 py-3 bg-elegant-surface-hover border border-elegant-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-elegant-gold font-mono"
            />
          </div>

          <button
            onClick={() => handleRunAudit(inputMint)}
            disabled={loading || isScanning}
            className="px-6 py-3 bg-elegant-gold hover:bg-elegant-gold-hover text-slate-950 font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isScanning || loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Audit Contract
              </>
            )}
          </button>
        </div>

        {/* Base58 Validation status */}
        {validationError && (
          <p className="text-xs text-rose-500 dark:text-rose-400 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {validationError}
          </p>
        )}

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-elegant-border">
          <span className="text-xs text-elegant-text-secondary font-medium mr-1">Quick Select:</span>
          {POPULAR_SOLANA_TOKENS.map((tk) => (
            <button
              key={tk.symbol}
              onClick={() => {
                setInputMint(tk.mint);
                handleRunAudit(tk.mint);
              }}
              className={`px-3 py-1 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${
                activeMint === tk.mint
                  ? 'bg-elegant-gold/15 border-elegant-gold/40 text-elegant-gold font-semibold'
                  : 'bg-elegant-surface-hover border border-elegant-border text-elegant-text-secondary hover:text-white hover:bg-elegant-surface'
              }`}
            >
              {tk.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-rose-600 dark:text-rose-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-sm">Audit Error</h4>
            <p className="text-sm opacity-90">{error}</p>
            <button
              onClick={() => handleRunAudit(inputMint, true)}
              className="mt-2 text-xs font-semibold underline hover:opacity-80"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main Audit Report Display */}
      {report && !isScanning && (
        <div className="space-y-6">

          {/* REQUIREMENT 6: Summary Section */}
          <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-elegant-border pb-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${getResultBadgeStyle(report.security.auditResult)}`}>
                    {report.security.auditResult}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-elegant-surface-hover text-white border border-elegant-border">
                    Risk Level: {report.security.riskLevel}
                  </span>
                  <span className="text-xs text-elegant-text-secondary flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {report.cached ? `Cached (${report.cachedAt})` : `Live Audit (${report.cachedAt})`}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Audit Summary & Security Score
                </h2>
                <p className="text-xs text-elegant-text-secondary flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-elegant-gold" />
                  Primary Security Data Source: <span className="font-medium text-white">{report.dataSource}</span>
                </p>
              </div>

              {/* Action & Refresh Controls */}
              <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                <button
                  onClick={() => handleRunAudit(report.token.mint, true)}
                  disabled={refreshing}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-elegant-surface-hover hover:bg-elegant-surface text-white border border-elegant-border transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-elegant-gold' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh Audit'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Security Score Meter */}
              <div className="lg:col-span-4 bg-elegant-surface-hover border border-elegant-border rounded-xl p-6 text-center space-y-3">
                <div className="text-xs font-semibold text-elegant-text-secondary uppercase tracking-wider">
                  Overall Security Score
                </div>
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="52"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-elegant-bg"
                      fill="transparent"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="52"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeDasharray={326.7}
                      strokeDashoffset={326.7 - (326.7 * report.security.overallScore) / 100}
                      className={
                        report.security.overallScore >= 85
                          ? 'text-emerald-500'
                          : report.security.overallScore >= 50
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-3xl font-black text-white font-mono">
                      {report.security.overallScore}
                    </span>
                    <span className="text-xs text-elegant-text-secondary block font-semibold">/ 100</span>
                  </div>
                </div>
                <div className="text-xs text-elegant-text-secondary font-medium">
                  {report.security.overallScore >= 85
                    ? 'Clean security architecture'
                    : report.security.overallScore >= 50
                    ? 'Moderate risk vectors identified'
                    : 'High security risk detected'}
                </div>
              </div>

              {/* Recommendation Box */}
              <div className="lg:col-span-8 space-y-3">
                <div className="text-xs font-semibold text-elegant-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-elegant-gold" />
                  Auditor Recommendation
                </div>
                <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-2">
                  <p className="text-sm font-medium text-white leading-relaxed">
                    {report.security.recommendation}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-elegant-text-secondary font-mono border-t border-elegant-border">
                    <span>Token: {report.token.name} ({report.token.symbol})</span>
                    <span>•</span>
                    <span>Holders: {report.token.holderCount.toLocaleString()}</span>
                    <span>•</span>
                    <span>Liquidity: {formatNumber(report.token.liquidityUSD, true)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* REQUIREMENT 3: Token Information Card */}
          <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-elegant-border pb-4">
              <Coins className="w-5 h-5 text-elegant-gold" />
              <h3 className="text-lg font-bold text-white">
                Token Identity & On-Chain Metadata
              </h3>
            </div>

            {/* Token Header Identity */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={report.token.logo}
                  alt={report.token.symbol}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-12 h-12 rounded-full border border-elegant-border object-cover bg-elegant-bg flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-extrabold text-white truncate">
                      {report.token.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-elegant-surface text-white border border-elegant-border flex-shrink-0">
                      ${report.token.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-elegant-text-secondary mt-1 truncate">
                    <span className="truncate">Mint: {report.token.mint.slice(0, 6)}...{report.token.mint.slice(-6)}</span>
                    <button
                      onClick={() => copyToClipboard(report.token.mint, 'mint')}
                      className="hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                      title="Copy mint address"
                    >
                      {copiedKey === 'mint' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={`https://solscan.io/token/${report.token.mint}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-elegant-gold transition-colors flex-shrink-0"
                      title="View on Solscan"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Price & Market Cap stats */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 min-w-0 text-left">
                <div className="min-w-0">
                  <div className="text-xs text-elegant-text-secondary font-medium">Price USD</div>
                  <div className="text-sm sm:text-base font-bold font-mono text-white truncate" title={formatNumber(report.token.priceUSD, true)}>
                    {formatNumber(report.token.priceUSD, true)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-elegant-text-secondary font-medium">Market Cap / FDV</div>
                  <div className="text-sm sm:text-base font-bold font-mono text-white truncate" title={formatNumber(report.token.marketCapUSD, true)}>
                    {formatNumber(report.token.marketCapUSD, true)}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1">
                <span className="text-elegant-text-secondary font-medium block">Total Supply</span>
                <span className="font-bold font-mono text-white block text-sm">
                  {formatNumber(report.token.totalSupply)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1">
                <span className="text-elegant-text-secondary font-medium block">Decimals</span>
                <span className="font-bold font-mono text-white block text-sm">
                  {report.token.decimals}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1">
                <span className="text-elegant-text-secondary font-medium block">Mint Authority Status</span>
                <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                  report.token.mintAuthority === 'Disabled' 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {report.token.mintAuthority === 'Disabled' ? 'Disabled (Renounced)' : 'Active (Mintable)'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1">
                <span className="text-elegant-text-secondary font-medium block">Freeze Authority Status</span>
                <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                  report.token.freezeAuthority === 'Disabled' 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {report.token.freezeAuthority === 'Disabled' ? 'Disabled' : 'Active (Freezeable)'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1 md:col-span-2">
                <span className="text-elegant-text-secondary font-medium block">Creator Wallet</span>
                <div className="flex items-center gap-2 font-mono text-white">
                  <span className="truncate">{report.token.creator}</span>
                  <button
                    onClick={() => copyToClipboard(report.token.creator, 'creator')}
                    className="hover:text-elegant-gold transition-colors cursor-pointer"
                  >
                    {copiedKey === 'creator' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`https://solscan.io/account/${report.token.creator}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-elegant-gold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1">
                <span className="text-elegant-text-secondary font-medium block">Metadata Security</span>
                <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                  !report.token.mutableMetadata 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                  {!report.token.mutableMetadata ? 'Immutable' : 'Mutable'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-elegant-surface-hover border border-elegant-border space-y-1">
                <span className="text-elegant-text-secondary font-medium block">Token Creation Date</span>
                <span className="font-medium text-white block">
                  {report.token.detectedAt ? new Date(report.token.detectedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* REQUIREMENT 5: 8 Core Security Checks Grid */}
          <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-elegant-border pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-elegant-gold" />
                <h3 className="text-lg font-bold text-white">
                  Automated Security Check Matrix
                </h3>
              </div>
              <span className="text-xs text-elegant-text-secondary font-medium">8 On-Chain Vectors Evaluated</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Check 1: Mint Authority */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.mintAuthority.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Mint Authority Status
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.mintAuthority.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.mintAuthority.details}
                  </p>
                </div>
              </div>

              {/* Check 2: Freeze Authority */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.freezeAuthority.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Freeze Authority Status
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.freezeAuthority.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.freezeAuthority.details}
                  </p>
                </div>
              </div>

              {/* Check 3: Market Liquidity */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.liquidityStatus.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    DEX Market Liquidity
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.liquidityStatus.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.liquidityStatus.details}
                  </p>
                </div>
              </div>

              {/* Check 4: LP Lock or Burn */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.lpLockStatus.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    LP Token Lock / Burn Verification
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.lpLockStatus.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.lpLockStatus.details}
                  </p>
                </div>
              </div>

              {/* Check 5: Top Holder Concentration */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.topHolderConcentration.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Top Holder Concentration
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.topHolderConcentration.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.topHolderConcentration.details}
                  </p>
                </div>
              </div>

              {/* Check 6: Insider Ownership */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.ownershipPattern.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Creator & Insider Holdings
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.ownershipPattern.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.ownershipPattern.details}
                  </p>
                </div>
              </div>

              {/* Check 7: Metadata Security */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.metadataSecurity.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Token Metadata Integrity
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.metadataSecurity.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.metadataSecurity.details}
                  </p>
                </div>
              </div>

              {/* Check 8: Honeypot / Sell Simulation */}
              <div className="p-4 rounded-xl bg-elegant-surface-hover border border-elegant-border flex items-start gap-3.5">
                {renderCheckIcon(report.security.checks.honeypotCheck.status)}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Honeypot & Sell Simulation
                  </h4>
                  <p className="text-xs font-semibold text-white">
                    {report.security.checks.honeypotCheck.message}
                  </p>
                  <p className="text-xs text-elegant-text-secondary leading-relaxed">
                    {report.security.checks.honeypotCheck.details}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* REQUIREMENT 4: Rugcheck Security Risk Vectors */}
          {report.security.risks && report.security.risks.length > 0 && (
            <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-elegant-border pb-3">
                <AlertTriangle className="w-5 h-5 text-elegant-gold" />
                <h3 className="text-lg font-bold text-white">
                  Rugcheck Flagged Threat Vectors ({report.security.risks.length})
                </h3>
              </div>

              <div className="space-y-3">
                {report.security.risks.map((risk, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border text-xs space-y-1 flex items-start gap-3 ${
                      risk.level === 'danger'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : risk.level === 'warn'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    }`}
                  >
                    <div className="mt-0.5">
                      {risk.level === 'danger' ? (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between font-bold text-sm">
                        <span>{risk.name}</span>
                        {risk.score > 0 && (
                          <span className="px-2 py-0.5 rounded bg-black/20 font-mono text-[10px]">
                            -{risk.score} pts
                          </span>
                        )}
                      </div>
                      <p className="opacity-90 leading-relaxed mt-1">{risk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Holders & Insider Distribution Table */}
          {report.security.topHolders && report.security.topHolders.length > 0 && (
            <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-elegant-border pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-elegant-gold" />
                  <h3 className="text-lg font-bold text-white">
                    Top Holder Distribution
                  </h3>
                </div>
                <span className="text-xs text-elegant-text-secondary font-mono">
                  Total Holders: {report.token.holderCount.toLocaleString()}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-elegant-border text-elegant-text-secondary font-semibold uppercase">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Wallet Address</th>
                      <th className="py-2.5 px-3">Balance</th>
                      <th className="py-2.5 px-3 text-right">% Supply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-border font-mono">
                    {report.security.topHolders.map((th, idx) => (
                      <tr key={idx} className="hover:bg-elegant-surface-hover transition-colors">
                        <td className="py-2.5 px-3 text-elegant-text-secondary font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white">{th.address.slice(0, 6)}...{th.address.slice(-6)}</span>
                            {th.insider && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Insider
                              </span>
                            )}
                            <a
                              href={`https://solscan.io/account/${th.address}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-elegant-text-secondary hover:text-elegant-gold transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-elegant-text-primary">
                          {formatNumber(th.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">
                          {th.pct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
