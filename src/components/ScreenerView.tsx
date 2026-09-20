import React, { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, AlertTriangle, ShieldCheck, ChevronDown, Check, X, ArrowDown } from 'lucide-react';
import { Token, Chain } from '../types';
import TokenIcon from './TokenIcon';
import ChainIcon from './ChainIcon';
import DexTradeButtons from './DexTradeButtons';
import { useLivePrice, useLivePriceContext } from './LivePriceContext';
import { screenerStore, ScreenerSort } from '../utils/screenerStore';

interface ScreenerViewProps {
  onSelectToken: (tokenAddress: string) => void;
  initialQuery?: string;
  onClose?: () => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  isActive?: boolean;
}

const ALL_CHAINS: (Chain | 'All')[] = ['All', 'Ethereum', 'Solana', 'BNB Chain', 'Base', 'Arbitrum', 'Avalanche'];

export default function ScreenerView({ 
  onSelectToken, 
  initialQuery, 
  onClose,
  scrollContainerRef,
  isActive = true 
}: ScreenerViewProps) {
  const initialSnapshot = screenerStore.getSnapshot();
  const [tokens, setTokens] = useState<Token[]>(initialSnapshot.tokens);
  const [search, setSearch] = useState(initialQuery !== undefined ? initialQuery : initialSnapshot.search);
  const [selectedChain, setSelectedChain] = useState<Chain | 'All'>(initialSnapshot.selectedChain);
  const [sortBy, setSortBy] = useState<ScreenerSort>(initialSnapshot.sortBy);
  const [visibleCount, setVisibleCount] = useState<number>(initialSnapshot.visibleCount || 50);
  const [loading, setLoading] = useState<boolean>(initialSnapshot.tokens.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { feedState, retryCount } = useLivePriceContext();

  // Close chain dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setChainDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Subscribe to central store updates (silent background merges & price sync)
  useEffect(() => {
    const unsubscribe = screenerStore.subscribe(() => {
      const snap = screenerStore.getSnapshot();
      setTokens(snap.tokens);
      setVisibleCount(snap.visibleCount);
      if (snap.tokens.length > 0) {
        setLoading(false);
        setError(null);
      }
    });
    return unsubscribe;
  }, []);

  // Save container scroll position on scroll
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;
    const handleScroll = () => {
      screenerStore.setScrollTop(container.scrollTop);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  // Restore scroll position whenever this view becomes active or mounts
  useEffect(() => {
    if (isActive) {
      const savedTop = screenerStore.getScrollTop();
      if (savedTop > 0) {
        requestAnimationFrame(() => {
          if (scrollContainerRef?.current) {
            scrollContainerRef.current.scrollTop = savedTop;
          }
        });
      }
    }
  }, [isActive, scrollContainerRef]);

  // Handle token fetching with deduplication, background updates, and zero full-screen flicker
  useEffect(() => {
    let isCancelled = false;

    screenerStore.setFilters(selectedChain, search, sortBy);

    const performFetch = async () => {
      const hasExisting = screenerStore.getTokens().length > 0;
      if (!hasExisting) {
        setLoading(true);
        setError(null);
      }

      try {
        const fetched = await screenerStore.fetchTokens({
          chain: selectedChain,
          search,
          sort: sortBy,
          silent: hasExisting
        });
        if (!isCancelled) {
          setTokens(fetched);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          if (screenerStore.getTokens().length === 0) {
            setError(err.message || 'Unable to fetch token screener data');
          }
          setLoading(false);
        }
      }
    };

    performFetch();

    // Background silent refresh every 25s
    const interval = setInterval(() => {
      screenerStore.fetchTokens({
        chain: selectedChain,
        search,
        sort: sortBy,
        silent: true
      }).catch(() => {});
    }, 25000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [selectedChain, search, sortBy]);

  // Handle live searches
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleSelectToken = (tokenAddress: string) => {
    if (scrollContainerRef?.current) {
      screenerStore.setScrollTop(scrollContainerRef.current.scrollTop);
    }
    screenerStore.setVisibleCount(visibleCount);
    onSelectToken(tokenAddress);
  };

  const handleLoadMore = () => {
    const next = Math.min(tokens.length, visibleCount + 50);
    setVisibleCount(next);
    screenerStore.setVisibleCount(next);
  };

  // Infinite scroll sentinel observer to automatically load next batch
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleCount < tokens.length) {
        const next = Math.min(tokens.length, visibleCount + 50);
        setVisibleCount(next);
        screenerStore.setVisibleCount(next);
      }
    }, { rootMargin: '300px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, tokens.length]);

  // Strictly filter out any token that lacks a positive live price
  const validLiveTokens = tokens.filter(t => 
    t && 
    t.address && 
    typeof t.price === 'number' && 
    !isNaN(t.price) && 
    t.price > 0
  );

  const displayedTokens = validLiveTokens.slice(0, visibleCount);
  const totalTokens = validLiveTokens.length;
  const displayedCount = displayedTokens.length;

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
                {displayedTokens.map((tok, idx) => (
                  <ScreenerRow
                    key={`${tok.address}-${tok.chain}`}
                    tok={tok}
                    idx={idx}
                    rowNumber={idx + 1}
                    onSelectToken={handleSelectToken}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic Batch Pagination & Cumulative Load More Controls */}
      {!loading && !error && displayedTokens.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-3 pt-2 pb-6">
          {/* Status Bar: "Showing 1–50 of 108 tokens" / "Showing 1–100 of 108 tokens" */}
          <div className="flex items-center gap-2 text-xs text-elegant-text-secondary font-mono">
            <span>Showing</span>
            <span className="text-white font-bold px-2 py-0.5 bg-elegant-surface border border-elegant-border rounded-md">
              1–{displayedCount}
            </span>
            <span>of</span>
            <span className="text-white font-bold">{totalTokens}</span>
            <span>verified live tokens</span>
          </div>

          {/* Load Next 50 Tokens button if more available */}
          {displayedCount < totalTokens ? (
            <div className="flex flex-col items-center gap-2 mt-1">
              <button
                type="button"
                onClick={handleLoadMore}
                className="flex items-center gap-2 px-6 py-2.5 bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white hover:text-elegant-gold text-xs font-semibold rounded-xl transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Load Next 50 Tokens ({totalTokens - displayedCount} remaining)</span>
              </button>

              {/* Infinite scroll sentinel trigger element */}
              <div ref={sentinelRef} className="h-4 w-full" />
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 font-mono italic mt-1">
              All {totalTokens} active on-chain pairs displayed
            </div>
          )}
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

  // Strictly guaranteed real live price (Never show 0, $0.00, N/A, or fake prices)
  const safePrice = (typeof price === 'number' && !isNaN(price) && price > 0)
    ? price
    : (typeof tok.price === 'number' && !isNaN(tok.price) && tok.price > 0 ? tok.price : 0.0001);

  const formattedPrice = safePrice < 0.01
    ? safePrice.toFixed(8)
    : safePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

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
