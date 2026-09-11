import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Flame, AlertCircle, RefreshCw, Layers, Zap, ShieldAlert, Award, Globe, ExternalLink, Twitter, MessageSquare, Sparkles, ChevronLeft, ChevronRight, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Token, Transaction, ChainStats } from '../types';
import TokenIcon from './TokenIcon';
import ChainIcon from './ChainIcon';
import DataLoader from './DataLoader';
import LivePriceTicker from './LivePriceTicker';
import { useLivePrice } from './LivePriceContext';


// Skeleton transaction item for DEX live loading
const SkeletonTxItem = () => (
  <div id="skeleton-tx-item" className="bg-elegant-bg/40 border border-elegant-border/40 rounded-lg p-2.5 flex flex-col space-y-2 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-1.5">
        <div className="w-10 h-4 bg-elegant-border-light/40 rounded" />
        <div className="w-14 h-3 bg-elegant-border-light/30 rounded" />
      </div>
      <div className="w-8 h-3 bg-elegant-border-light/30 rounded" />
    </div>
    <div className="flex items-center justify-between">
      <div className="w-16 h-3 bg-elegant-border-light/40 rounded" />
      <div className="w-10 h-3.5 bg-elegant-border-light/40 rounded" />
    </div>
    <div className="flex items-center justify-between pt-1 border-t border-elegant-border/20">
      <div className="w-24 h-2 bg-elegant-border-light/30 rounded" />
      <div className="w-12 h-3 bg-elegant-border-light/40 rounded" />
    </div>
  </div>
);

// Backoff fetch helper
async function fetchWithBackoff(url: string, options: any = {}, retries = 2, delay = 500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res;
    }
    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    const nextDelay = delay * 2;
    return fetchWithBackoff(url, options, retries - 1, nextDelay);
  }
}

const formatLargeNumber = (num: number) => {
  if (num === undefined || num === null) return "Unavailable";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(0)}`;
};

interface DashboardRowProps {
  key?: string;
  tok: Token;
  idx: number;
  onSelectToken: (tokenAddress: string) => void;
  type: 'trending' | 'gainer';
}

function DashboardRow({ tok, idx, onSelectToken, type }: DashboardRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { price, priceChange24h, flash } = useLivePrice(
    tok.address,
    tok.price,
    tok.priceChange24h,
    rowRef
  );

  const formattedPrice = price < 0.01 
    ? price.toFixed(8) 
    : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const isPositive = priceChange24h >= 0;

  return (
    <div
      ref={rowRef}
      onClick={() => onSelectToken(tok.address)}
      className="flex items-center justify-between py-2.5 hover:bg-elegant-surface-hover px-1 rounded cursor-pointer transition-colors group min-w-0 w-full"
    >
      {/* Column 1: Rank, icon, symbol/chain badge */}
      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
        {type === 'trending' ? (
          <span className="text-elegant-text-secondary font-mono text-xs w-6 flex-shrink-0 font-bold">#{idx + 1}</span>
        ) : (
          <span className="text-emerald-400 font-mono text-xs w-6 flex-shrink-0 font-bold">#{idx + 1}</span>
        )}
        <div className="flex-shrink-0">
          <TokenIcon symbol={tok.symbol} address={tok.address} logoUrl={tok.logo} size="sm" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className="text-white font-bold text-xs group-hover:text-elegant-gold transition-colors truncate">
              {tok.symbol}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-elegant-text-secondary font-mono uppercase px-1 py-0.5 bg-elegant-bg rounded border border-elegant-border flex-shrink-0">
              <ChainIcon chain={tok.chain} className="w-3 h-3 shrink-0" />
              <span>{tok.chain}</span>
            </span>
          </div>
          <span className="text-elegant-text-secondary text-[10px] truncate max-w-[120px] sm:max-w-[160px] block">
            {tok.name}
          </span>
        </div>
      </div>

      {/* Column 2: Price + Volume/LP */}
      <div className="flex flex-col items-end px-2 flex-shrink-0 text-right min-w-[85px]">
        <span
          className={`font-mono text-xs font-semibold transition-all duration-300 rounded-sm px-1 py-0.5 ${
            flash === 'up'
              ? 'text-emerald-400 bg-emerald-500/15 scale-105 font-bold'
              : flash === 'down'
                ? 'text-red-400 bg-red-500/15 scale-105 font-bold'
                : 'text-white'
          }`}
        >
          ${formattedPrice}
        </span>
        <span className="text-elegant-text-secondary text-[10px] font-mono whitespace-nowrap">
          {type === 'trending' 
            ? `$${tok.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })} Vol`
            : `$${tok.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })} LP`
          }
        </span>
      </div>

      {/* Column 3: % change, right-aligned with fixed width */}
      <div className="w-20 flex-shrink-0 text-right flex justify-end items-center">
        <span
          className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded transition-all duration-300 ${
            flash === 'up'
              ? 'text-emerald-400 bg-emerald-500/15 scale-105 font-bold'
              : flash === 'down'
                ? 'text-red-400 bg-red-500/15 scale-105 font-bold'
                : isPositive 
                  ? 'text-emerald-400 bg-emerald-400/5' 
                  : 'text-red-400 bg-red-400/5'
          }`}
        >
          {isPositive ? '▲' : '▼'} {Math.abs(priceChange24h).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

interface DashboardViewProps {
  onSelectToken: (tokenAddress: string) => void;
  onSearch: (query: string) => void;
}

export default function DashboardView({ onSelectToken, onSearch }: DashboardViewProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [stats, setStats] = useState<{ fearGreed: number; tvl: number; volume24h: number; chainStats: ChainStats[]; ethGasPrice?: number; solGasPrice?: number; activeDexIndexers?: number } | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading] = useState(true);

  // DexScreener ads state
  const [ads, setAds] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);

  // Ads carousel state for single ad rotation (5s transition)
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-play timer (5s total per slide, no progress bar)
  useEffect(() => {
    if (ads.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      if (!isHovered) {
        setCurrentAdIndex((prev) => (prev >= ads.length - 1 ? 0 : prev + 1));
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [ads.length, isHovered]);

  useEffect(() => {
    let active = true;
    const fetchAds = async () => {
      try {
        const res = await fetch('/api/dex/ads');
        if (res.ok && active) {
          const data = await res.json();
          setAds(data);
        }
      } catch (err) {
        console.warn('Failed to fetch DexScreener ads:', err);
      } finally {
        if (active) {
          setAdsLoading(false);
        }
      }
    };
    fetchAds();
    return () => {
      active = false;
    };
  }, []);

  // Auto-scan when a blockchain address is detected
  useEffect(() => {
    const trimmed = searchVal.trim();
    const isEvm = /^0x[a-fA-F0-9]{40}$/i.test(trimmed);
    const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
    if (isEvm || isSol) {
      onSearch(trimmed);
    }
  }, [searchVal, onSearch]);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0);

  const fetchData = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    const isJson = (res: Response) => res.ok && res.headers.get('content-type')?.includes('application/json');

    try {
      const results = await Promise.allSettled([
        fetchWithBackoff('/api/tokens').then(async res => {
          if (!res.ok) throw new Error(`Tokens API returned status ${res.status}`);
          return isJson(res) ? res.json() : [];
        }),
        fetchWithBackoff('/api/stats').then(async res => {
          if (!res.ok) throw new Error(`Stats API returned status ${res.status}`);
          return isJson(res) ? res.json() : null;
        }),
        fetchWithBackoff('/api/dex/live').then(async res => {
          if (!res.ok) throw new Error(`Live API returned status ${res.status}`);
          return isJson(res) ? res.json() : [];
        })
      ]);

      const [tokensRes, statsRes, txRes] = results;

      if (tokensRes.status === 'fulfilled' && Array.isArray(tokensRes.value) && tokensRes.value.length > 0) {
        const seen = new Set<string>();
        const uniqueTokens = tokensRes.value.filter(t => {
          if (!t || !t.address) return false;
          const addr = t.address.toLowerCase();
          if (seen.has(addr)) return false;
          seen.add(addr);
          return true;
        });
        setTokens(uniqueTokens);
        setError(null);
        setLastFetched(new Date());
      } else if (tokens.length === 0) {
        setError('Connecting to live DEX indexers...');
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }

      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) {
        const txData = txRes.value;
        setRecentTx(prev => {
          if (prev.length === 0) {
            return txData.slice(0, 50);
          }
          const combined = [...txData, ...prev];
          const uniqueMap = new Map<string, typeof txData[0]>();
          for (const tx of combined) {
            if (tx && tx.id && !uniqueMap.has(tx.id)) {
              uniqueMap.set(tx.id, tx);
            }
          }
          const sorted = Array.from(uniqueMap.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return sorted.slice(0, 50);
        });
      }

    } catch (err: any) {
      console.warn('Dashboard background sync warning:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 12000); // Poll every 12 seconds for tick updates
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFetched) {
        setTimeSinceUpdate(Math.round((Date.now() - lastFetched.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastFetched]);

  useEffect(() => {
    if (!window.location.host || window.location.origin === 'null') {
      console.warn('[WS DEX Indexer Client] Empty or sandboxed host. WebSocket disabled.');
      setWsConnected(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let heartbeatInterval: any = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      console.log(`[WS DEX Indexer Client] Connecting to stream at ${wsUrl}`);
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS DEX Indexer Client] Connection established.');
          if (isMounted) {
            setWsConnected(true);
          }
          
          // Start heartbeat every 20 seconds to prevent silent connection drop
          clearInterval(heartbeatInterval);
          heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const eventType = message.type || message.event;
            
            if ((eventType === 'init' || eventType === 'initial_transactions') && Array.isArray(message.data)) {
              setRecentTx(prev => {
                if (prev.length > 0) return prev; // Preserve previous data if we already have it
                return message.data.slice(0, 50);
              });
            } else if ((eventType === 'transaction' || eventType === 'new_transaction') && message.data) {
              setRecentTx(prev => {
                const txId = message.data.id;
                if (prev.some(t => t.id === txId)) return prev;
                const updated = [message.data, ...prev];
                return updated.slice(0, 50);
              });
            }
          } catch (err) {
            console.error('[WS DEX Indexer Client] Error parsing incoming stream:', err);
          }
        };

        ws.onclose = () => {
          console.warn('[WS DEX Indexer Client] Disconnected. Reconnecting silently in 3 seconds...');
          if (isMounted) {
            setWsConnected(false);
            reconnectTimeout = setTimeout(connect, 3000);
          }
          clearInterval(heartbeatInterval);
        };

        ws.onerror = (err) => {
          console.log('[WS DEX Indexer Client] Connection state note: Utilizing secure HTTP polling fallback.', err);
        };
      } catch (err) {
        console.warn('[WS DEX Indexer Client] WebSocket connection setup failed. Utilizing secure HTTP polling fallback.', err);
        if (isMounted) {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(heartbeatInterval);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      onSearch(searchVal.trim());
    }
  };



  // Segment tokens for home categories
  const trending = [...tokens].sort((a, b) => (b.volume24h * Math.abs(b.priceChange1h)) - (a.volume24h * Math.abs(a.priceChange1h))).slice(0, 20);
  const topGainers = [...tokens].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 20);
  const newPairs = [...tokens].sort((a, b) => a.tokenAgeDays - b.tokenAgeDays).slice(0, 20);
  const hotPairs = [...tokens].filter(t => t.promoted).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-elegant-surface to-elegant-bg border border-elegant-border p-8 shadow-xl">
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-15 pointer-events-none bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-elegant-gold/20 via-transparent to-transparent"></div>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Real-Time DEX Analytics <span className="text-elegant-gold gold-glow">& AI Security</span>
          </h1>
          <p className="text-elegant-text-secondary text-sm leading-relaxed font-sans max-w-2xl">
            Screener tracking swaps, pool lock milestones, burns, and security risk vectors across Ethereum, Solana, Base, and BNB Chain.
          </p>
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-2xl pt-2">
            <input
              type="text"
              placeholder="Search Token, Ticker, Contract (0x...), or Pair Address..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full sm:flex-1 min-w-0 px-4 py-3 bg-elegant-bg border border-elegant-border rounded-lg text-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-elegant-gold focus:border-transparent placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="w-full sm:w-auto shrink-0 px-6 py-3 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg text-sm font-semibold rounded-lg transition-all shadow-md active:scale-95 cursor-pointer text-center whitespace-nowrap flex items-center justify-center border border-transparent"
            >
              Search Token
            </button>
          </form>
        </div>
      </div>

      {/* Promoted Ads Section (DexScreener API - Matches Token Page Ads) */}
      {!adsLoading && ads.length > 0 && ads[currentAdIndex] && (
        <div 
          className="relative overflow-hidden bg-elegant-surface border border-elegant-border hover:border-elegant-gold/30 rounded-2xl p-4 md:p-5 transition-all duration-300 shadow-xl"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Manual Navigation Controls */}
          {ads.length > 1 && (
            <div className="absolute top-3 right-3 flex items-center space-x-1.5 z-10">
              <button
                type="button"
                onClick={() => {
                  setCurrentAdIndex(prev => prev === 0 ? ads.length - 1 : prev - 1);
                }}
                className="p-1 rounded bg-elegant-bg/80 hover:bg-elegant-surface border border-elegant-border/60 hover:border-elegant-gold/30 text-zinc-400 hover:text-white transition-all cursor-pointer"
                title="Previous Ad"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentAdIndex(prev => prev === ads.length - 1 ? 0 : prev + 1);
                }}
                className="p-1 rounded bg-elegant-bg/80 hover:bg-elegant-surface border border-elegant-border/60 hover:border-elegant-gold/30 text-zinc-400 hover:text-white transition-all cursor-pointer"
                title="Next Ad"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Left Side: Banner / Creative Graphic */}
            <div className="w-full md:w-[220px] h-[110px] md:h-auto min-h-[110px] rounded-xl overflow-hidden relative bg-elegant-bg/80 border border-elegant-border/40 shrink-0">
                {ads[currentAdIndex].header ? (
                  <img
                    src={ads[currentAdIndex].header}
                    alt={`${ads[currentAdIndex].tokenSymbol || 'Ad'} Banner`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    onError={(e) => {
                      (e.target as any).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-elegant-surface via-elegant-bg to-elegant-surface flex items-center justify-center font-mono text-[10px] text-zinc-600 select-none">
                    No banner available
                  </div>
                )}
                {/* Chain Overlay Badge */}
                <span className="absolute top-2 left-2 text-[8px] uppercase font-mono tracking-wider bg-black/70 backdrop-blur-sm text-elegant-gold border border-elegant-gold/30 px-1.5 py-0.5 rounded">
                  {ads[currentAdIndex].chainId || 'web3'}
                </span>
              </div>

              {/* Right Side: Ad Details & Ticker */}
              <div className="flex-1 flex flex-col justify-between space-y-3 min-w-0">
                
                {/* Header: Title, Icon, Badge */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-elegant-bg border border-elegant-border overflow-hidden shrink-0">
                    {ads[currentAdIndex].icon ? (
                      <img
                        src={ads[currentAdIndex].icon}
                        alt={`${ads[currentAdIndex].tokenSymbol} Icon`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-elegant-gold/10 flex items-center justify-center font-bold text-elegant-gold text-xs">
                        {ads[currentAdIndex].tokenSymbol?.slice(0, 2).toUpperCase() || 'AD'}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm font-bold text-white truncate">
                        {ads[currentAdIndex].tokenName || 'Sponsored Project'}
                      </span>
                      <span className="text-[8px] bg-elegant-gold/20 text-elegant-gold border border-elegant-gold/30 px-1.5 py-0.5 rounded-sm uppercase tracking-wider scale-90 font-mono font-bold">
                        AD
                      </span>
                    </div>
                    <span className="text-xs font-mono text-elegant-text-secondary">
                      {ads[currentAdIndex].tokenSymbol || 'TOKEN'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-elegant-text-secondary leading-relaxed line-clamp-2 md:line-clamp-3">
                  {ads[currentAdIndex].description || 'No description provided. Click through to view charts, transaction ledger, audits, or official socials.'}
                </p>

                {/* Footer: Social links & Call-to-action */}
                <div className="flex items-center justify-between pt-2 border-t border-elegant-border/30 gap-4">
                  {/* Social media icons */}
                  <div className="flex items-center space-x-1.5">
                    {ads[currentAdIndex].links && ads[currentAdIndex].links.length > 0 ? (
                      ads[currentAdIndex].links.map((link: any, idxLink: number) => {
                        const isTwitter = link.type?.toLowerCase() === 'twitter';
                        const isTelegram = link.type?.toLowerCase() === 'telegram';
                        const isDiscord = link.type?.toLowerCase() === 'discord';

                        return (
                          <a
                            key={idxLink}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded bg-elegant-bg border border-elegant-border/80 text-zinc-400 hover:text-white hover:border-elegant-gold/20 transition-all duration-200 active:scale-95"
                            title={link.label || link.type}
                          >
                            {isTwitter ? (
                              <Twitter className="w-3.5 h-3.5" />
                            ) : isTelegram || isDiscord ? (
                              <MessageSquare className="w-3.5 h-3.5" />
                            ) : (
                              <Globe className="w-3.5 h-3.5" />
                            )}
                          </a>
                        );
                      })
                    ) : (
                      <span className="text-[9px] font-mono text-zinc-600">No social links</span>
                    )}
                  </div>

                  {/* Visit Project Website button */}
                  {(() => {
                    const currentAd = ads[currentAdIndex];
                    const webLink = currentAd?.links?.find((l: any) =>
                      l.type?.toLowerCase() === 'website' ||
                      l.label?.toLowerCase()?.includes('website') ||
                      (l.url && !l.url.includes('dexscreener.com') && !l.url.includes('twitter.com') && !l.url.includes('x.com') && !l.url.includes('t.me') && !l.url.includes('telegram') && !l.url.includes('discord'))
                    );
                    const projectUrl = webLink?.url || (currentAd?.url && !currentAd.url.includes('dexscreener.com') ? currentAd.url : null) || currentAd?.links?.[0]?.url || currentAd?.url;

                    if (!projectUrl) return null;

                    return (
                      <a
                        href={projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase font-mono text-elegant-gold hover:text-white hover:underline transition-all"
                      >
                        <span>Visit Website</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    );
                  })()}
                </div>

              </div>
            </div>
          </div>
        )}



      {/* Global Ledger Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Volume */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-0 overflow-hidden hover:border-elegant-gold/30 transition-colors">
          <span className="text-elegant-text-secondary text-[11px] font-mono font-medium tracking-wide">GLOBAL 24H VOLUME</span>
          <span 
            className="text-white text-base sm:text-lg font-bold font-mono mt-1 break-all truncate select-all" 
            title={stats ? `$${stats.volume24h.toLocaleString()}` : ""}
          >
            {stats ? formatLargeNumber(stats.volume24h) : (error ? "Offline" : "--")}
          </span>
          <span className="text-emerald-400 text-[10px] font-mono mt-1 truncate font-semibold">
            DefiLlama 24H Live Stream
          </span>
        </div>

        {/* Card 2: TVL */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-0 overflow-hidden hover:border-elegant-gold/30 transition-colors">
          <span className="text-elegant-text-secondary text-[11px] font-mono font-medium tracking-wide">TOTAL VALUE LOCKED</span>
          <span 
            className="text-white text-base sm:text-lg font-bold font-mono mt-1 break-all truncate select-all" 
            title={stats ? `$${stats.tvl.toLocaleString()}` : ""}
          >
            {stats ? formatLargeNumber(stats.tvl) : (error ? "Offline" : "--")}
          </span>
          <span className="text-elegant-text-secondary text-[10px] font-mono mt-1 truncate">
            DefiLlama Aggregate
          </span>
        </div>

        {/* Card 3: Fear & Greed */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-0 overflow-hidden hover:border-elegant-gold/30 transition-colors">
          <span className="text-elegant-text-secondary text-[11px] font-mono font-medium tracking-wide">FEAR & GREED INDEX</span>
          <div className="flex items-center space-x-2 mt-1 min-w-0">
            <span className="text-elegant-gold text-base sm:text-lg font-bold font-mono gold-glow truncate">
              {stats ? stats.fearGreed : '--'}
            </span>
            {stats && (
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border truncate ${
                stats.fearGreed >= 75 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                stats.fearGreed >= 55 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                stats.fearGreed >= 45 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                stats.fearGreed >= 25 ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' :
                'text-red-400 bg-red-500/10 border-red-500/30'
              }`}>
                {stats.fearGreed >= 75 ? 'Ext Greed' : (stats.fearGreed >= 55 ? 'Greed' : (stats.fearGreed >= 45 ? 'Neutral' : (stats.fearGreed >= 25 ? 'Fear' : 'Ext Fear')))}
              </span>
            )}
          </div>
          <div className="w-full bg-elegant-border h-1.5 rounded-full mt-2 overflow-hidden p-0.5">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                stats && stats.fearGreed >= 55 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
                stats && stats.fearGreed >= 45 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' :
                'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              }`} 
              style={{ width: `${stats ? Math.max(5, stats.fearGreed) : 50}%` }}
            ></div>
          </div>
        </div>

        {/* Card 4: SOL Gas */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-0 overflow-hidden hover:border-elegant-gold/30 transition-colors">
          <span className="text-elegant-text-secondary text-[11px] font-mono font-medium tracking-wide">SOLANA GAS FEE</span>
          <span 
            className="text-white text-base sm:text-lg font-bold font-mono mt-1 break-all truncate select-all" 
            title={stats && stats.solGasPrice !== undefined ? `${stats.solGasPrice.toFixed(8)} SOL` : ""}
          >
            {stats && stats.solGasPrice !== undefined ? `${stats.solGasPrice.toFixed(5)} SOL` : (error ? "Offline" : "--")}
          </span>
          <span className="text-emerald-400 text-[10px] font-mono truncate font-medium">
            Helius / RPC Prioritization
          </span>
        </div>

        {/* Card 5: ETH Gas */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-0 overflow-hidden hover:border-elegant-gold/30 transition-colors">
          <span className="text-elegant-text-secondary text-[11px] font-mono font-medium tracking-wide">ETHEREUM GAS PRICE</span>
          <span 
            className="text-white text-base sm:text-lg font-bold font-mono mt-1 break-all truncate select-all" 
            title={stats && stats.ethGasPrice !== undefined ? `${stats.ethGasPrice} Gwei` : ""}
          >
            {stats && stats.ethGasPrice !== undefined ? `${stats.ethGasPrice} Gwei` : (error ? "Offline" : "--")}
          </span>
          <span className="text-amber-400 text-[10px] font-mono truncate font-medium">
            Mainnet Base + Priority
          </span>
        </div>

        {/* Card 6: Active Chain Indexers */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-0 overflow-hidden hover:border-elegant-gold/30 transition-colors">
          <span className="text-elegant-text-secondary text-[11px] font-mono font-medium tracking-wide">ACTIVE DEX INDEXERS</span>
          <span 
            className="text-white text-base sm:text-lg font-bold font-mono mt-1 break-all truncate select-all" 
            title={stats && stats.activeDexIndexers !== undefined ? `${stats.activeDexIndexers} chains syncing live` : ""}
          >
            {stats && stats.activeDexIndexers !== undefined ? `${stats.activeDexIndexers} Chains` : (error ? "Offline" : "7 Chains")}
          </span>
          <span className="text-emerald-400 text-[10px] font-mono truncate font-medium">
            ● 100% Health & Synced
          </span>
        </div>
      </div>

      {/* Promoted / Hot Pairs Carousel */}
      {hotPairs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5">
            <Flame className="w-4 h-4 text-elegant-gold animate-pulse" />
            <h3 className="text-elegant-gold text-xs font-bold uppercase tracking-wider font-mono gold-glow">Sponsored Featured Projects</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {hotPairs.map((tok, idx) => (
              <div
                key={`${tok.address}-hot-${idx}`}
                onClick={() => onSelectToken(tok.address)}
                className="bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/40 rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-md flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 truncate">
                  <TokenIcon symbol={tok.symbol} address={tok.address} logoUrl={tok.logo} size="md" />
                  <div className="space-y-1 truncate">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-bold font-mono group-hover:text-elegant-gold transition-colors">{tok.symbol}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-elegant-text-secondary uppercase px-1.5 py-0.5 bg-elegant-bg rounded border border-elegant-border">
                        <ChainIcon chain={tok.chain} className="w-3 h-3 shrink-0" />
                        <span>{tok.chain}</span>
                      </span>
                    </div>
                    <p className="text-elegant-text-secondary text-xs truncate max-w-[120px]">{tok.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <LivePriceTicker
                    tokenAddress={tok.address}
                    initialPrice={tok.price}
                    initialPriceChange24h={tok.priceChange24h}
                    showChange={true}
                    className="text-white text-sm font-semibold"
                    changeClassName="text-xs"
                    showFlash={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Tokens & Market Highlights */}
      <div className="w-full space-y-6">
        
        {/* Token Highlights columns */}
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Trending Pairs */}
            <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-elegant-border">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-elegant-gold" />
                  <h3 className="text-white font-semibold text-sm">Trending Pairs</h3>
                </div>
                <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">By 1H Volume</span>
              </div>
              <div className="divide-y divide-elegant-border">
                {trending.map((tok, idx) => (
                  <DashboardRow
                    key={`${tok.address}-trending-${idx}`}
                    tok={tok}
                    idx={idx}
                    onSelectToken={onSelectToken}
                    type="trending"
                  />
                ))}
              </div>
            </div>

            {/* Top Gainers */}
            <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-elegant-border">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-elegant-gold" />
                  <h3 className="text-white font-semibold text-sm">Top Gainers</h3>
                </div>
                <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">24H Performance</span>
              </div>
              <div className="divide-y divide-elegant-border">
                {topGainers.map((tok, idx) => (
                  <DashboardRow
                    key={`${tok.address}-gainer-${idx}`}
                    tok={tok}
                    idx={idx}
                    onSelectToken={onSelectToken}
                    type="gainer"
                  />
                ))}
              </div>
            </div>

          </div>

          {/* New Pairs Section */}
          <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-elegant-border">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-elegant-gold" />
                <h3 className="text-white font-semibold text-sm">Recently Created Pairs</h3>
              </div>
              <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">Listening On Block Factory</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-elegant-border text-[11px] text-elegant-text-secondary font-mono">
                    <th className="pb-2 font-medium w-8 text-center">#</th>
                    <th className="pb-2 font-medium">PAIR NAME / SYMBOL</th>
                    <th className="pb-2 font-medium">CHAIN / DEX</th>
                    <th className="pb-2 font-medium">LIQUIDITY</th>
                    <th className="pb-2 font-medium">RISK INDEX</th>
                    <th className="pb-2 font-medium text-right">SECURITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-elegant-border/40">
                  {newPairs.map((tok, idx) => (
                    <tr
                      key={`${tok.address}-new-${idx}`}
                      onClick={() => onSelectToken(tok.address)}
                      className="hover:bg-elegant-surface-hover cursor-pointer transition-colors group"
                    >
                      <td className="py-3 pr-2 text-center text-elegant-text-secondary font-mono text-xs font-bold w-8">
                        #{idx + 1}
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center space-x-2.5">
                          <TokenIcon symbol={tok.symbol} address={tok.address} logoUrl={tok.logo} size="sm" />
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-xs group-hover:text-elegant-gold transition-colors">{tok.symbol}</span>
                            <span className="text-[10px] text-elegant-text-secondary font-mono truncate max-w-[120px]">{tok.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-mono inline-flex items-center gap-1">
                            <ChainIcon chain={tok.chain} className="w-3.5 h-3.5 shrink-0" />
                            <span>{tok.chain}</span>
                          </span>
                          <span className="text-[10px] text-elegant-text-secondary">{tok?.dexName || tok?.dex || '--'}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-2 font-mono text-xs text-white font-semibold">
                        ${tok.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 pr-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono border ${
                          tok.rugRiskScore === 'Low' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' :
                          tok.rugRiskScore === 'Medium' ? 'bg-amber-950/40 text-amber-400 border-amber-900/60' :
                          'bg-red-950/40 text-red-400 border-red-900/60'
                        }`}>
                          {tok.rugRiskScore}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <span className={`text-xs font-mono font-bold ${
                            tok.securityScore >= 80 ? 'text-emerald-400' :
                            tok.securityScore >= 60 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {tok.securityScore}/100
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
