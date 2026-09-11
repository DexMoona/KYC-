import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, ChevronDown, Check, AlertTriangle, Layers } from 'lucide-react';
import { DexPool, fetchTokenPools, openDexTradePage, getDexLogo } from '../utils/dexRouter';

interface DexTradeButtonsProps {
  tokenAddress: string;
  chain?: string;
  symbol?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showPoolSelector?: boolean;
  onPoolChange?: (pool: DexPool) => void;
}

export default function DexTradeButtons({
  tokenAddress,
  chain,
  symbol = 'Token',
  className = '',
  size = 'md',
  showPoolSelector = true,
  onPoolChange
}: DexTradeButtonsProps) {
  const [pools, setPools] = useState<DexPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<DexPool | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPools = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setErrorMsg(null);

    const { pools: discoveredPools, error } = await fetchTokenPools(tokenAddress, chain);
    
    setLoading(false);

    if (error || !discoveredPools || discoveredPools.length === 0) {
      setPools([]);
      setSelectedPool(null);
      setErrorMsg(error || 'Trading pool not available.');
      return;
    }

    setPools(discoveredPools);
    
    // Default to pool with highest verified liquidity
    const bestPool = discoveredPools[0];
    setSelectedPool(bestPool);
    if (onPoolChange) onPoolChange(bestPool);
  };

  useEffect(() => {
    loadPools(true);

    // Refresh pool routes periodically (every 30s)
    const interval = setInterval(() => {
      loadPools(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [tokenAddress, chain]);

  const handleSelectPool = (pool: DexPool) => {
    setSelectedPool(pool);
    setShowDropdown(false);
    if (onPoolChange) onPoolChange(pool);
  };

  const handleBuy = () => {
    if (!selectedPool || !selectedPool.buyUrl || selectedPool.liquidity <= 0) return;
    openDexTradePage(selectedPool.buyUrl);
  };

  const handleSell = () => {
    if (!selectedPool || !selectedPool.sellUrl || selectedPool.liquidity <= 0) return;
    openDexTradePage(selectedPool.sellUrl);
  };

  // Button sizes styling
  const sizeClasses = {
    sm: {
      btn: 'px-2.5 py-1.5 text-[11px]',
      icon: 'w-3.5 h-3.5',
      logo: 'w-3.5 h-3.5',
      badge: 'text-[9px]'
    },
    md: {
      btn: 'px-3.5 py-2 text-xs font-bold',
      icon: 'w-4 h-4',
      logo: 'w-4 h-4',
      badge: 'text-[10px]'
    },
    lg: {
      btn: 'px-5 py-2.5 text-sm font-bold',
      icon: 'w-4.5 h-4.5',
      logo: 'w-5 h-5',
      badge: 'text-[11px]'
    }
  }[size];

  // Render loading state
  if (loading) {
    return (
      <div className={`flex flex-col space-y-1.5 ${className}`}>
        <div className={`flex items-center justify-center space-x-2 bg-slate-800/60 border border-slate-700/60 rounded-lg ${sizeClasses.btn} text-slate-400 font-mono animate-pulse`}>
          <RefreshCw className={`${sizeClasses.icon} animate-spin text-emerald-400`} />
          <span>Discovering DEX pools...</span>
        </div>
      </div>
    );
  }

  // Render no pool or error state
  if (errorMsg || !selectedPool || pools.length === 0 || selectedPool.liquidity <= 0) {
    const displayMessage = errorMsg === 'Unable to locate a valid trading pool.' 
      ? 'Unable to locate a valid trading pool.' 
      : 'Trading pool not available.';

    return (
      <div className={`flex flex-col space-y-1.5 ${className}`}>
        <div className="flex items-center space-x-2">
          <button
            disabled
            className={`flex-1 flex items-center justify-center space-x-2 bg-slate-800/40 border border-slate-800 text-slate-500 rounded-lg ${sizeClasses.btn} cursor-not-allowed opacity-60 font-mono`}
          >
            <span>Buy</span>
          </button>
          <button
            disabled
            className={`flex-1 flex items-center justify-center space-x-2 bg-slate-800/40 border border-slate-800 text-slate-500 rounded-lg ${sizeClasses.btn} cursor-not-allowed opacity-60 font-mono`}
          >
            <span>Sell</span>
          </button>
        </div>
        <div className="flex items-center justify-center space-x-1.5 py-1 px-2.5 bg-rose-950/40 border border-rose-900/50 rounded text-rose-400 text-[11px] font-mono font-medium text-center">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{displayMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {/* Pool Selector Dropdown if multiple pools exist */}
      {showPoolSelector && pools.length > 1 ? (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-md text-[11px] text-slate-300 font-mono transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-2 truncate">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Active DEX:</span>
              <img
                src={selectedPool?.dexIcon || getDexLogo(selectedPool?.dexName || '')}
                alt={selectedPool?.dexName || ''}
                className="w-3.5 h-3.5 rounded-full object-contain shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <span className="font-bold text-white truncate">{selectedPool?.dexName || ''}</span>
              <span className="text-emerald-400 font-bold shrink-0">
                (${(selectedPool?.liquidity || 0) >= 1000000 ? `${((selectedPool?.liquidity || 0) / 1000000).toFixed(1)}M` : `${((selectedPool?.liquidity || 0) / 1000).toFixed(0)}k`} Liq)
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0 text-slate-400">
              <span className="text-[9px] bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-semibold">{pools.length} Pools</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1">
              <div className="px-3 py-1.5 bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-700/60">
                Discovered Liquidity Pools for {symbol}
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60">
                {pools.map((p, idx) => {
                  const isSelected = selectedPool.pairAddress === p.pairAddress && selectedPool.dexName === p.dexName;
                  return (
                    <button
                      key={`${p.pairAddress}-${idx}`}
                      type="button"
                      onClick={() => handleSelectPool(p)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800 transition-all font-mono ${
                        isSelected ? 'bg-slate-800/90 text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <img
                          src={p.dexIcon || getDexLogo(p.dexName)}
                          alt={p.dexName}
                          className="w-4 h-4 rounded-full object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold flex items-center space-x-1.5">
                            <span>{p.dexName}</span>
                            {idx === 0 && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 rounded font-mono">
                                Highest Liq
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{p.tradingPair}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-xs font-bold text-emerald-400">${p.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div className="text-[9px] text-slate-400">Vol: ${p.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        selectedPool && (
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Detected DEX:</span>
              <img
                src={selectedPool.dexIcon || getDexLogo(selectedPool.dexName)}
                alt={selectedPool.dexName}
                className="w-3.5 h-3.5 rounded-full object-contain shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <span className="font-bold text-white truncate">{selectedPool.dexName}</span>
            </div>
            <span className="text-emerald-400 font-bold text-[10px] shrink-0">
              ${selectedPool.liquidity >= 1000000 ? `${(selectedPool.liquidity / 1000000).toFixed(1)}M` : `${(selectedPool.liquidity / 1000).toFixed(0)}k`} Liq
            </span>
          </div>
        )
      )}

      {/* Primary Buy & Sell Trading Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={handleBuy}
          className={`flex-1 flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-lg ${sizeClasses.btn} transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer group`}
          title={`Buy ${symbol} on ${selectedPool?.dexName || 'DEX'}`}
        >
          <img
            src={selectedPool?.dexIcon || getDexLogo(selectedPool?.dexName)}
            alt={selectedPool?.dexName || 'DEX'}
            className={`${sizeClasses.logo} rounded-full object-contain shrink-0 border border-slate-950/30 group-hover:scale-110 transition-transform`}
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <span className="truncate">Buy</span>
          <ExternalLink className={`${sizeClasses.icon} opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0`} />
        </button>

        <button
          type="button"
          onClick={handleSell}
          className={`flex-1 flex items-center justify-center space-x-2 bg-rose-500 hover:bg-rose-400 active:bg-rose-600 text-slate-950 font-black rounded-lg ${sizeClasses.btn} transition-all shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] cursor-pointer group`}
          title={`Sell ${symbol} on ${selectedPool?.dexName || 'DEX'}`}
        >
          <img
            src={selectedPool?.dexIcon || getDexLogo(selectedPool?.dexName)}
            alt={selectedPool?.dexName || 'DEX'}
            className={`${sizeClasses.logo} rounded-full object-contain shrink-0 border border-slate-950/30 group-hover:scale-110 transition-transform`}
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <span className="truncate">Sell</span>
          <ExternalLink className={`${sizeClasses.icon} opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0`} />
        </button>
      </div>
    </div>
  );
}
