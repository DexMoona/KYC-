import React, { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, RefreshCw, AlertTriangle, ShieldCheck, ChevronDown, Check, X } from 'lucide-react';
import { Token, Chain } from '../types';
import TokenIcon from './TokenIcon';
import ChainIcon from './ChainIcon';
import LivePriceTicker from './LivePriceTicker';
import DexTradeButtons from './DexTradeButtons';
import { useLivePrice, useLivePriceContext } from './LivePriceContext';
import { fetchWithTimeoutAndRetry } from '../utils/api';

interface ScreenerViewProps {
  onSelectToken: (tokenAddress: string) => void;
  initialQuery?: string;
  onClose?: () => void;
}

const ALL_CHAINS: (Chain | 'All')[] = ['All', 'Ethereum', 'Solana', 'BNB Chain', 'Base', 'Arbitrum', 'Avalanche'];

export default function ScreenerView({ onSelectToken, initialQuery, onClose }: ScreenerViewProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [search, setSearch] = useState(initialQuery || '');
  const [selectedChain, setSelectedChain] = useState<Chain | 'All'>('All');
  const [sortBy, setSortBy] = useState<'trending' | 'gainers' | 'losers' | 'volume' | 'liquidity' | 'new'>('trending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const pageSize = 100;

  const { feedState, retryCount } = useLivePriceContext();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setChainDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isJson = (res: Response) => res.ok && res.headers.get('content-type')?.includes('application/json');

  const fetchTokens = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (selectedChain !== 'All') params.append('chain', selectedChain);
      if (search) params.append('search', search);
      params.append('sort', sortBy);

      const res = await fetchWithTimeoutAndRetry(`/api/tokens?${params.toString()}`, {}, 15000, 2);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const seen = new Set<string>();
        const unique = data.filter(t => {
          const addr = t.address?.toLowerCase();
          if (!addr) return false;
          if (seen.has(addr)) return false;
          seen.add(addr);
          return true;
        });
        setTokens(unique);
        setError(null);
      } else if (Array.isArray(data)) {
        setTokens(data);
        setError(null);
      } else {
        setTokens([]);
      }
    } catch (err: any) {
      console.warn('Notice when syncing screener tokens:', err);
      // If we already have tokens in state, do not blank out the UI during periodic auto-refresh
      if (tokens.length === 0) {
        // Attempt quick resilient fallback to base tokens endpoint
        try {
          const fallbackRes = await fetch('/api/tokens');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (Array.isArray(fallbackData) && fallbackData.length > 0) {
              setTokens(fallbackData);
              setError(null);
              return;
            }
          }
        } catch {
          // ignore fallback error
        }
        setError(err.message || 'Unable to fetch live token data — retrying');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchTokens(true);
    const interval = setInterval(() => {
      fetchTokens(false);
    }, 30000); // 30-second background auto-refresh
    return () => clearInterval(interval);
  }, [selectedChain, search, sortBy]);

  // Handle live searches
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const totalTokens = tokens.length;
  const totalPages = Math.ceil(totalTokens / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalTokens);
  const paginatedTokens = tokens.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 md:p-5 space-y-3.5 shadow-md">
        {/* Live Feed Badge & Close Icon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
          <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-elegant-bg border border-elegant-border rounded-lg font-mono text-[10px] uppercase shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${
                feedState === 'live' 
                  ? 'bg-emerald-400 animate-pulse' 
                  : feedState === 'reconnecting' 
                    ? 'bg-amber-400 animate-pulse' 
                    : feedState === 'unavailable' 
                      ? 'bg-red-500' 
                      : 'bg-blue-400 animate-pulse'
              }`} />
              <span className="text-elegant-text-secondary font-bold whitespace-nowrap">
                {feedState === 'live' && 'LIVE FEED'}
                {feedState === 'reconnecting' && `RECONNECTING (${retryCount}/5)`}
                {feedState === 'connecting' && 'CONNECTING'}
                {feedState === 'unavailable' && 'OFFLINE'}
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-elegant-surface border border-elegant-border hover:border-elegant-gold/60 text-white hover:text-elegant-gold transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
                title="Close Screener"
                aria-label="Close Screener"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar: Search, Quick Sort Pills, Chain & Sort Dropdowns */}
        <div className="flex flex-col gap-3 pt-3 border-t border-elegant-border">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Search bar */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-elegant-text-secondary" />
              <input
                type="text"
                placeholder="Search token name, ticker, pair, contract..."
                value={search}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-3 py-2 bg-elegant-bg border border-elegant-border rounded-lg text-white font-sans text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-elegant-gold focus:border-transparent placeholder:text-zinc-600 transition-all"
              />
            </div>

            {/* Compact Dropdowns Row: All Chains (left) and Trending (right) on same row */}
            <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto shrink-0">
              {/* Compact Chain Selector Dropdown */}
              <div className="relative shrink-0" ref={chainDropdownRef}>
                <button
                  type="button"
                  onClick={() => setChainDropdownOpen(prev => !prev)}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-elegant-bg border border-elegant-border rounded-lg text-xs font-semibold text-white hover:bg-elegant-surface-hover focus:outline-none focus:ring-1 focus:ring-elegant-gold cursor-pointer flex items-center justify-between gap-1.5 transition-all shadow-sm max-w-[140px] sm:max-w-[160px]"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <ChainIcon chain={selectedChain} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {selectedChain === 'All' ? 'All Chains' : selectedChain}
                    </span>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-elegant-text-secondary shrink-0 transition-transform duration-200 ${chainDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Chain Dropdown Menu */}
                {chainDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] bg-elegant-surface border border-elegant-border rounded-xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                    {ALL_CHAINS.map(ch => {
                      const isSelected = selectedChain === ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            setSelectedChain(ch);
                            setChainDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-elegant-gold/15 text-white border border-elegant-gold/40 font-bold'
                              : 'text-zinc-300 hover:bg-elegant-surface-hover hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <ChainIcon chain={ch} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{ch === 'All' ? 'All Chains' : ch}</span>
                          </div>
                          {isSelected && <Check className="w-3 h-3 text-elegant-gold shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Compact Sort Dropdown ("Trending") */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="pl-7 pr-6 py-1.5 sm:py-2 bg-elegant-bg border border-elegant-border rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-elegant-gold cursor-pointer appearance-none transition-all truncate shadow-sm max-w-[130px] sm:max-w-[160px]"
                >
                  <option value="trending">Trending</option>
                  <option value="gainers">Top 24H Gainers</option>
                  <option value="losers">Top 24H Losers</option>
                  <option value="volume">Highest 24H Volume</option>
                  <option value="liquidity">Core Liquidity Pool</option>
                  <option value="new">Recently Added Pairs</option>
                </select>
                <SlidersHorizontal className="absolute left-2 top-2 sm:top-2.5 w-3.5 h-3.5 text-elegant-text-secondary pointer-events-none" />
                <ChevronDown className="absolute right-2 top-2 sm:top-2.5 w-3 h-3 text-elegant-text-secondary pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Screener Table */}
      <div className="bg-elegant-surface border border-elegant-border rounded-xl overflow-hidden shadow-xl">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-4">
            <AlertTriangle className="text-red-500 w-10 h-10 animate-pulse" />
            <h4 className="text-white font-bold text-sm">On-chain query failed</h4>
            <p className="text-elegant-text-secondary text-xs max-w-md">
              {error}
            </p>
            <button
              onClick={() => fetchTokens(true)}
              className="px-4 py-1.5 bg-elegant-gold text-elegant-bg font-bold font-sans text-xs rounded-lg hover:bg-elegant-gold-hover transition-all duration-200 shadow-md cursor-pointer mt-2"
            >
              Retry Connection
            </button>
          </div>
        ) : !loading && tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-4">
            <AlertTriangle className="text-amber-500 w-10 h-10 animate-pulse" />
            <h4 className="text-white font-bold text-sm">No tokens matched your filters</h4>
            <p className="text-elegant-text-secondary text-xs max-w-md">
              Try selecting a different blockchain network, checking your search query spelling, or adjusting the sorting method.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedChain('All');
                setSortBy('trending');
              }}
              className="px-4 py-1.5 bg-elegant-gold text-elegant-bg font-bold font-sans text-xs rounded-lg hover:bg-elegant-gold-hover transition-all duration-200 shadow-md cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-elegant-border text-[11px] text-elegant-text-secondary font-mono uppercase bg-elegant-surface-hover/30">
                  <th className="py-3 pl-4 pr-2 font-semibold text-center text-zinc-400 w-12">#</th>
                  <th className="py-3 px-4 font-semibold">TOKEN DETAILS</th>
                  <th className="py-3 px-4 font-semibold">PRICE</th>
                  <th className="py-3 px-4 font-semibold text-right">1H %</th>
                  <th className="py-3 px-4 font-semibold text-right">24H %</th>
                  <th className="py-3 px-4 font-semibold text-right">24H VOLUME</th>
                  <th className="py-3 px-4 font-semibold text-right">LIQUIDITY</th>
                  <th className="py-3 px-4 font-semibold text-right">MKT CAP</th>
                  <th className="py-3 px-4 font-semibold text-center w-24">SECURITY</th>
                  <th className="py-3 px-4 font-semibold text-right">RUG RISK</th>
                  <th className="py-3 px-4 font-semibold text-center min-w-[210px]">SMART DEX ROUTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elegant-border/40">
                {paginatedTokens.map((tok, idx) => (
                  <ScreenerRow
                    key={`${tok.address}-${idx}`}
                    tok={tok}
                    idx={idx}
                    rowNumber={startIndex + idx + 1}
                    onSelectToken={onSelectToken}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-elegant-border cursor-pointer select-none ${
              currentPage === 1
                ? 'bg-elegant-bg/40 text-elegant-text-secondary/50 border-elegant-border/50 cursor-not-allowed'
                : 'bg-elegant-surface text-white hover:bg-elegant-surface-hover active:scale-95'
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-elegant-border cursor-pointer select-none ${
              currentPage === totalPages
                ? 'bg-elegant-bg/40 text-elegant-text-secondary/50 border-elegant-border/50 cursor-not-allowed'
                : 'bg-elegant-surface text-white hover:bg-elegant-surface-hover active:scale-95'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

interface ScreenerRowProps {
  key?: string;
  tok: Token;
  idx: number;
  rowNumber: number;
  onSelectToken: (tokenAddress: string) => void;
}

function ScreenerRow({ tok, idx, rowNumber, onSelectToken }: ScreenerRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Viewport-aware live price hook
  const { price, priceChange24h, flash } = useLivePrice(
    tok.address,
    tok.price,
    tok.priceChange24h,
    rowRef
  );

  const formattedPrice = price < 0.01
    ? price.toFixed(8)
    : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const isPositive1h = tok.priceChange1h >= 0;
  const isPositive24h = priceChange24h >= 0;

  return (
    <tr
      ref={rowRef}
      onClick={() => onSelectToken(tok.address)}
      className="hover:bg-elegant-surface-hover cursor-pointer transition-colors group"
    >
      {/* Sequential Row Number */}
      <td className="py-3.5 pl-4 pr-2 font-mono text-xs text-zinc-400 font-medium text-center w-12">
        {rowNumber}
      </td>

      {/* Name / Symbol / Chain */}
      <td className="py-3.5 px-4">
        <div className="flex items-center space-x-3">
          <TokenIcon symbol={tok.symbol} address={tok.address} logoUrl={tok.logo} size="sm" />
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="text-white font-bold text-xs group-hover:text-elegant-gold transition-colors">
                {tok.symbol}
              </span>
              {tok.promoted && (
                <span className="bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/30 text-[8px] uppercase font-bold px-1 rounded-sm">
                  PRO
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[9px] text-elegant-text-secondary font-mono uppercase px-1 py-0.5 bg-elegant-bg rounded border border-elegant-border shrink-0">
                <ChainIcon chain={tok.chain} className="w-3 h-3 shrink-0" />
                <span>{tok.chain}</span>
              </span>
            </div>
            <span className="text-elegant-text-secondary text-[10px] max-w-[130px] truncate">{tok.name}</span>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-3.5 px-4 font-mono text-xs font-semibold">
        <span
          className={`transition-all duration-300 rounded-sm px-1 py-0.5 ${
            flash === 'up'
              ? 'text-emerald-400 bg-emerald-500/15 scale-105 font-bold'
              : flash === 'down'
                ? 'text-red-400 bg-red-500/15 scale-105 font-bold'
                : 'text-white'
          }`}
        >
          ${formattedPrice}
        </span>
      </td>

      {/* 1h Change */}
      <td className={`py-3.5 px-4 font-mono text-xs text-right font-semibold ${isPositive1h ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive1h ? '+' : ''}{tok.priceChange1h.toFixed(2)}%
      </td>

      {/* 24h Change */}
      <td className={`py-3.5 px-4 font-mono text-xs text-right font-bold transition-colors duration-200 ${isPositive24h ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive24h ? '+' : ''}{priceChange24h.toFixed(2)}%
      </td>

      {/* 24h Vol */}
      <td className="py-3.5 px-4 font-mono text-xs text-right text-gray-300">
        ${tok.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </td>

      {/* Liquidity */}
      <td className="py-3.5 px-4 font-mono text-xs text-right text-white">
        ${tok.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </td>

      {/* Mcap */}
      <td className="py-3.5 px-4 font-mono text-xs text-right text-elegant-text-secondary">
        ${tok.mcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </td>

      {/* Safety Score */}
      <td className="py-3.5 px-4 text-center">
        <div className="inline-flex items-center space-x-1 justify-center bg-elegant-bg border border-elegant-border rounded px-1.5 py-0.5">
          {tok.securityScore >= 80 ? (
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-500" />
          )}
          <span className={`text-[10px] font-mono font-bold ${
            tok.securityScore >= 80 ? 'text-emerald-400' :
            tok.securityScore >= 60 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {tok.securityScore}
          </span>
        </div>
      </td>

      {/* Rug Risk Rating */}
      <td className="py-3.5 px-4 text-right">
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono border ${
          tok.rugRiskScore === 'Low' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' :
          tok.rugRiskScore === 'Medium' ? 'bg-amber-950/40 text-amber-400 border-amber-900/60' :
          'bg-red-950/40 text-red-400 border-red-900/60'
        }`}>
          {tok.rugRiskScore}
        </span>
      </td>

      {/* Smart DEX Routing Buttons */}
      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
        <DexTradeButtons
          tokenAddress={tok.address}
          chain={tok.chain}
          symbol={tok.symbol}
          size="sm"
          showPoolSelector={false}
        />
      </td>
    </tr>
  );
}
