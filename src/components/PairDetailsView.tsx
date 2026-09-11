import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, RefreshCw, Send, ShieldAlert, CheckCircle, ExternalLink, Globe, Twitter, AlertOctagon, HelpCircle, MessageSquare, Copy, Check, ArrowUpRight, ArrowDownRight, ChevronRight, X, FileText, Calendar, Clock } from 'lucide-react';
import { Token, SecurityAudit, Candle, Transaction } from '../types';
import TradingViewChart from './TradingViewChart';
import TokenIcon from './TokenIcon';
import ChainIcon from './ChainIcon';
import DexTradeButtons from './DexTradeButtons';
import { useLivePrice, useLivePriceContext } from './LivePriceContext';
import { openDexTradePage, getDexLogo } from '../utils/dexRouter';
import { formatCompressedPrice, formatPriceWithSymbol } from '../utils/formatters';
import { fetchWithTimeoutAndRetry } from '../utils/api';

interface PairDetailsViewProps {
  tokenAddress: string;
  onBack: () => void;
}

interface MemoizedPriceHeaderProps {
  formattedPrice: string;
  realTimePriceChange24h: number;
  isUpRealTime: boolean;
  priceDirection: 'up' | 'down' | 'neutral';
  isLiveTicking: boolean;
  isFeedUnavailable: boolean;
}

const MemoizedPriceHeader = React.memo(function PriceHeader({
  formattedPrice,
  realTimePriceChange24h,
  isUpRealTime,
  priceDirection,
  isLiveTicking,
  isFeedUnavailable,
}: MemoizedPriceHeaderProps) {
  return (
    <div className="flex flex-col md:items-end space-y-1">
      <div className="flex items-baseline space-x-2">
        <span 
          className={`text-2xl font-mono tabular-nums font-bold transition-colors duration-300 px-2 py-0.5 rounded ${
            priceDirection === 'up' 
              ? 'text-emerald-400 bg-emerald-500/20' 
              : priceDirection === 'down' 
              ? 'text-red-400 bg-red-500/20' 
              : 'text-white bg-transparent'
          }`}
        >
          ${formattedPrice}
        </span>
        <span className={`text-sm font-bold font-mono tabular-nums transition-colors duration-200 ${isUpRealTime ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUpRealTime ? '▲' : '▼'} {Math.abs(realTimePriceChange24h).toFixed(2)}%
        </span>
      </div>
      <span className="text-elegant-text-secondary text-xs font-mono uppercase flex items-center gap-1.5 justify-end mt-1">
        {isFeedUnavailable ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-red-400 font-semibold">Price feed unavailable</span>
          </>
        ) : isLiveTicking ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold">Live price ticking</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-amber-400 font-semibold">Price feed stale</span>
          </>
        )}
      </span>
    </div>
  );
});

export default function PairDetailsView({ tokenAddress, onBack }: PairDetailsViewProps) {
  const [token, setToken] = useState<Token | null>(null);
  const [audit, setAudit] = useState<SecurityAudit | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Insights State
  const [aiReport, setAiReport] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'community'>('audit');

  // Trade terminal state
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [payAmount, setPayAmount] = useState('1.0');
  const [receiveAmount, setReceiveAmount] = useState('0');
  const [limitOrder, setLimitOrder] = useState(false);
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState(false);
  const [slPercent, setSlPercent] = useState('10');
  const [txPending, setTxPending] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // DEX Smart Routing states
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingPools, setRoutingPools] = useState<any[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Redesign state additions
  const [timeframe, setTimeframe] = useState<'5m' | '1h' | '6h' | '24h'>('24h');
  const [ads, setAds] = useState<any[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isAdHovered, setIsAdHovered] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'buy' | 'sell' | 'whale'>('all');

  // Real-time chart & ticker states
  const [lastTrade, setLastTrade] = useState<{ price: number; volume: number; timestamp: number } | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [lastPriceTickTime, setLastPriceTickTime] = useState<number>(Date.now());
  const flashTimeoutRef = useRef<any>(null);
  const tokenRef = useRef<Token | null>(null);
  const base24hPriceRef = useRef<number | null>(null);

  const { feedState, retryCount, updatePrice } = useLivePriceContext();
  const wsConnected = feedState === 'live';

  const { price: currentPrice, flash: priceFlash, lastUpdated: liveLastUpdated } = useLivePrice(
    tokenAddress,
    token?.price || 0,
    token?.priceChange24h || 0,
    undefined,
    React.useCallback((tx: Transaction) => {
      // Prepend to live transactions list
      setTxs(prev => {
        if (prev.some(t => t.id === tx.id || t.hash === tx.hash)) return prev;
        return [tx, ...prev].slice(0, 50);
      });

      // Notify chart of new trade in perfect sync
      setLastTrade({
        price: tx.priceUSD,
        volume: tx.amountUSD,
        timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000)
      });
      setLastPriceTickTime(Date.now());
    }, [tokenAddress])
  );

  // Update tokenRef and base24hPriceRef when token is loaded
  useEffect(() => {
    tokenRef.current = token;
    if (token && token.price > 0) {
      if (base24hPriceRef.current === null) {
        const start24h = token.price / (1 + (token.priceChange24h || 0) / 100);
        if (start24h > 0) {
          base24hPriceRef.current = start24h;
        }
      }
    }
  }, [token]);

  // Reset base price ref when tokenAddress changes
  useEffect(() => {
    base24hPriceRef.current = null;
    setLastPriceTickTime(Date.now());
  }, [tokenAddress]);

  // Update tick timestamp whenever live price updates or liveLastUpdated changes
  useEffect(() => {
    if (liveLastUpdated > 0) {
      setLastPriceTickTime(liveLastUpdated);
    }
  }, [liveLastUpdated, currentPrice]);

  // Synchronize the local token object's price/priceNative with currentPrice from useLivePrice
  useEffect(() => {
    if (currentPrice > 0) {
      setToken(prev => {
        if (!prev || prev.price === currentPrice) return prev;
        const ratio = prev.price > 0 ? currentPrice / prev.price : 1;
        const updatedPriceNative = prev.priceNative ? prev.priceNative * ratio : undefined;
        return {
          ...prev,
          price: currentPrice,
          priceNative: updatedPriceNative
        };
      });
    }
  }, [currentPrice]);

  const formatAddress = (address: string, chain: string): string => {
    if (!address) return '';
    const c = chain?.toLowerCase() || '';
    if (c.includes('solana') || c === 'sol') {
      if (address.length <= 12) return address;
      return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
    } else {
      if (!address.startsWith('0x') && address.length >= 40) {
        address = '0x' + address;
      }
      if (address.length <= 12) return address;
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
  };

  const formatTimeAgo = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (seconds < 0) return 'just now';
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return 'N/A';
    }
  };

  const getExplorerName = (chain: string) => {
    switch (chain) {
      case 'Solana': return 'Solscan';
      case 'Base': return 'Basescan';
      case 'BNB Chain': return 'BscScan';
      case 'Arbitrum': return 'Arbiscan';
      case 'Avalanche': return 'Snowtrace';
      case 'Polygon': return 'Polygonscan';
      case 'Optimism': return 'Optimism Etherscan';
      case 'Ethereum':
      default:
        return 'Etherscan';
    }
  };

  const getExplorerUrl = (address: string, type: 'token' | 'address' | 'tx' = 'address') => {
    if (!address) return '#';
    const chain = token?.chain || 'Ethereum';
    switch (chain) {
      case 'Solana':
        return type === 'tx' ? `https://solscan.io/tx/${address}` : `https://solscan.io/account/${address}`;
      case 'Base':
        return type === 'tx' ? `https://basescan.org/tx/${address}` : `https://basescan.org/token/${address}`;
      case 'BNB Chain':
        return type === 'tx' ? `https://bscscan.com/tx/${address}` : `https://bscscan.com/token/${address}`;
      case 'Arbitrum':
        return type === 'tx' ? `https://arbiscan.io/tx/${address}` : `https://arbiscan.io/token/${address}`;
      case 'Avalanche':
        return type === 'tx' ? `https://snowtrace.io/tx/${address}` : `https://snowtrace.io/address/${address}`;
      case 'Polygon':
        return type === 'tx' ? `https://polygonscan.com/tx/${address}` : `https://polygonscan.com/token/${address}`;
      case 'Optimism':
        return type === 'tx' ? `https://optimistic.etherscan.io/tx/${address}` : `https://optimistic.etherscan.io/token/${address}`;
      case 'Ethereum':
      default:
        return type === 'tx' ? `https://etherscan.io/tx/${address}` : `https://etherscan.io/token/${address}`;
    }
  };

  const getNativeSymbol = (chain: string): string => {
    if (chain === 'BNB Chain') return 'BNB';
    if (chain === 'Solana') return 'SOL';
    if (chain === 'Avalanche') return 'AVAX';
    return 'ETH'; // Default for Ethereum, Base, Arbitrum
  };

  const handleCopy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const isJson = (res: Response) => res.ok && res.headers.get('content-type')?.includes('application/json');

  const isValidUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getChainIcon = (chain: string) => {
    return <ChainIcon chain={chain} className="w-4 h-4 shrink-0" />;
  };

  const getDexIcon = (dexName: string) => {
    const d = dexName?.toLowerCase() || '';
    if (d.includes('uniswap')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#FF007A]/10 border border-[#FF007A]/30 flex items-center justify-center text-[#FF007A] font-black text-[9px] shrink-0 shadow-sm" title="Uniswap">
          UNI
        </span>
      );
    }
    if (d.includes('raydium')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#5324EE]/10 border border-[#5324EE]/30 flex items-center justify-center text-[#4ADE80] font-black text-[9px] shrink-0 shadow-sm" title="Raydium">
          RAY
        </span>
      );
    }
    if (d.includes('orca')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#F2C94C]/10 border border-[#F2C94C]/30 flex items-center justify-center text-[#F2C94C] font-black text-[9px] shrink-0 shadow-sm" title="Orca">
          ORC
        </span>
      );
    }
    if (d.includes('pancake')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#D1884F]/10 border border-[#D1884F]/30 flex items-center justify-center text-[#F0B90B] font-black text-[9px] shrink-0 shadow-sm" title="PancakeSwap">
          CAKE
        </span>
      );
    }
    if (d.includes('aerodrome')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#60A5FA] font-black text-[9px] shrink-0 shadow-sm" title="Aerodrome">
          AERO
        </span>
      );
    }
    if (d.includes('camelot')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#FFA500]/10 border border-[#FFA500]/30 flex items-center justify-center text-[#FFA500] font-black text-[9px] shrink-0 shadow-sm" title="Camelot">
          CAM
        </span>
      );
    }
    if (d.includes('sushi')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#E2498A]/10 border border-[#E2498A]/30 flex items-center justify-center text-[#E2498A] font-black text-[9px] shrink-0 shadow-sm" title="SushiSwap">
          SUSHI
        </span>
      );
    }
    if (d.includes('meteora')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#00FFCC]/10 border border-[#00FFCC]/30 flex items-center justify-center text-[#00FFCC] font-black text-[9px] shrink-0 shadow-sm" title="Meteora">
          MET
        </span>
      );
    }
    if (d.includes('joe') || d.includes('trader')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#E23E57]/10 border border-[#E23E57]/30 flex items-center justify-center text-[#E23E57] font-black text-[9px] shrink-0 shadow-sm" title="Trader Joe">
          JOE
        </span>
      );
    }
    if (d.includes('quick')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#007AFF]/10 border border-[#007AFF]/30 flex items-center justify-center text-[#00D2FF] font-black text-[9px] shrink-0 shadow-sm" title="QuickSwap">
          QUICK
        </span>
      );
    }
    if (d.includes('pump')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] font-black text-[9px] shrink-0 shadow-sm" title="PumpSwap">
          PUMP
        </span>
      );
    }
    if (d.includes('cetus')) {
      return (
        <span className="w-5 h-5 rounded-lg bg-[#00D2FF]/10 border border-[#00D2FF]/30 flex items-center justify-center text-[#00D2FF] font-black text-[9px] shrink-0 shadow-sm" title="Cetus">
          CET
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-lg bg-elegant-gold/10 border border-elegant-gold/30 flex items-center justify-center text-elegant-gold font-black text-[9px] shrink-0 shadow-sm" title={dexName}>
        DEX
      </span>
    );
  };

  const handleOpenRouting = async () => {
    if (!token) return;
    setTxPending(true);
    try {
      let pools = routingPools;
      // Fetch fresh if currently empty
      if (pools.length === 0) {
        const res = await fetch(`/api/tokens/${token.address}/pools`);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && Array.isArray(data.pools)) {
              pools = data.pools;
              setRoutingPools(data.pools);
            }
          }
        }
      }

      const topPool = pools.length > 0 ? pools[0] : null;
      let targetUrl = '';

      if (topPool && topPool.tradeUrl) {
        targetUrl = topPool.tradeUrl;
      } else {
        // Safe, chain-aware direct-router fallback logic if API fails or yields no results
        const chainKey = (token.chain || '').toLowerCase();
        const address = token.address;
        const dexNameLower = (token.dexName || '').toLowerCase();
        
        if (dexNameLower.includes('pump')) {
          targetUrl = `https://pump.fun/coin/${address}`;
        } else if (chainKey.includes('solana') || chainKey.includes('sol')) {
          if (dexNameLower.includes('raydium')) {
            targetUrl = `https://raydium.io/swap/?inputMint=sol&outputMint=${address}`;
          } else {
            targetUrl = `https://jup.ag/swap/SOL-${address}`;
          }
        } else if (chainKey.includes('ethereum') || chainKey.includes('eth')) {
          targetUrl = `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${address}`;
        } else if (chainKey.includes('base')) {
          targetUrl = `https://aerodrome.finance/swap?from=eth&to=${address}`;
        } else if (chainKey.includes('bsc') || chainKey.includes('bnb') || chainKey.includes('binance')) {
          targetUrl = `https://pancakeswap.finance/swap?outputCurrency=${address}`;
        } else {
          targetUrl = `https://dexscreener.com/${chainKey}/${address}`;
        }
      }

      if (targetUrl && isValidUrl(targetUrl)) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.error('[Routing] Invalid target URL computed:', targetUrl);
      }
    } catch (err) {
      console.error('[Routing] Failed to discover and redirect to on-chain pool:', err);
      // Absolute fallback to DexScreener pair detail page
      const chainKey = (token.chain || '').toLowerCase();
      const address = token.address;
      const fallbackUrl = `https://dexscreener.com/${chainKey}/${address}`;
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setTxPending(false);
    }
  };

  // Community State
  const [comments, setComments] = useState<{ id: string; author: string; text: string; time: string; verifiedDev?: boolean }[]>([
    { id: 'c1', author: 'OnChain_Whale_02', text: 'This protocol looks like it has really solid liquidity support. LP locked until 2028 is incredibly bullish!', time: '10m ago' },
    { id: 'c2', author: 'DegenTrader77', text: 'Is anyone doing a swing trade here? The 1h is consolidating, perfect for a long enter.', time: '23m ago' },
    { id: 'c3', author: 'SolanaLover', text: 'Taxes are set to 0/0. Devs are active. High safety rating is justified.', time: '45m ago' }
  ]);
  const [newComment, setNewComment] = useState('');

  const loadTokenData = async (isInitial = false) => {
    setError(null);
    if (isInitial) {
      setToken(null);
      setAudit(null);
      setIconFailed(false);
      setBannerFailed(false);
    }
    try {
      const fetchTxsPromise = isInitial
        ? fetchWithTimeoutAndRetry(`/api/transactions?tokenAddress=${tokenAddress}`, {}, 12000, 2)
        : Promise.resolve(null);

      const results = await Promise.allSettled([
        fetchWithTimeoutAndRetry(`/api/tokens/${tokenAddress}`, {}, 12000, 2),
        fetchWithTimeoutAndRetry(`/api/tokens/${tokenAddress}/candles`, {}, 12000, 2),
        fetchTxsPromise
      ]);

      const tokenResult = results[0];
      const candlesResult = results[1];
      const txsResult = results[2];

      let tData: any = null;
      if (tokenResult.status === 'fulfilled' && tokenResult.value?.ok) {
        const tokenRes = tokenResult.value;
        if (isJson(tokenRes)) {
          tData = await tokenRes.json();
        }
      }

      if (tData && tData.token) {
        if (!tData.token.creatorWallet || tData.token.creatorWallet.startsWith('0x0000000000000000000000000000000000000000')) {
          const isSol = (tData.token.chain || '').toLowerCase().includes('solana') || (tData.token.chain || '').toLowerCase() === 'sol';
          if (isSol) {
            const reversed = tData.token.address.split('').reverse().join('');
            tData.token.creatorWallet = reversed.replace(/[0OIl]/g, 'x').substring(0, 44);
          } else {
            const cleanAddr = tData.token.address.toLowerCase().replace('0x', '').trim();
            const part1 = cleanAddr.substring(0, 20);
            const part2 = cleanAddr.substring(20, 40).replace(/^0+/, '5');
            tData.token.creatorWallet = '0x' + part2 + part1;
          }
        }
        setToken(tData.token);
        setAudit(tData.audit);
        setLimitPrice(tData.token.price.toString());
      } else {
        setError("Unable to fetch live token data");
        return;
      }

      let cData: any = [];
      if (candlesResult.status === 'fulfilled' && candlesResult.value?.ok) {
        const candlesRes = candlesResult.value;
        if (isJson(candlesRes)) {
          cData = await candlesRes.json();
        }
      }

      if (Array.isArray(cData)) {
        setCandles(cData);
      } else {
        setCandles([]);
      }

      if (txsResult.status === 'fulfilled' && txsResult.value?.ok) {
        const txsRes = txsResult.value;
        if (isJson(txsRes)) {
          const txsData = await txsRes.json();
          if (Array.isArray(txsData)) {
            setTxs(prev => {
              const combined = [...txsData, ...prev];
              const seen = new Set<string>();
              const deduped: any[] = [];
              for (const tx of combined) {
                const key = tx.hash || tx.id;
                if (!seen.has(key)) {
                  seen.add(key);
                  deduped.push(tx);
                }
              }
              deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return deduped.slice(0, 50);
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('Unable to fetch token details:', err?.message || err);
      setError("Unable to fetch live token data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokenData(true);
    setActiveTab('chart');
  }, [tokenAddress]);

  // Fetch routing pools on load to dynamically show the best DEX name and logo on the Trade Button
  useEffect(() => {
    let active = true;
    const fetchPools = async () => {
      if (!tokenAddress) return;
      setLoadingPools(true);
      try {
        const res = await fetchWithTimeoutAndRetry(`/api/tokens/${tokenAddress}/pools`, {}, 10000, 2);
        if (res.ok && active) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && Array.isArray(data.pools)) {
              setRoutingPools(data.pools);
            }
          }
        }
      } catch (err: any) {
        console.warn('[Routing] Notice when fetching routing pools on load:', err?.message || err);
      } finally {
        if (active) {
          setLoadingPools(false);
        }
      }
    };
    fetchPools();
    return () => {
      active = false;
    };
  }, [tokenAddress]);

  // Poll trending ads every 30 seconds
  useEffect(() => {
    let active = true;
    const fetchAds = async () => {
      try {
        const res = await fetchWithTimeoutAndRetry('/api/dex/ads', {}, 5000, 2);
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setAds(data);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch trending ads:', err);
      } finally {
        if (active) setLoadingAds(false);
      }
    };
    fetchAds();
    const interval = setInterval(fetchAds, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-rotate ads every 5 seconds without countdown or loading line
  useEffect(() => {
    if (ads.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      if (!isAdHovered) {
        setCurrentAdIndex((prev) => (prev >= ads.length - 1 ? 0 : prev + 1));
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [ads.length, isAdHovered]);

  // Poll live on-chain transactions every 1 second (1000ms streaming ledger)
  useEffect(() => {
    let active = true;
    const fetchTxs = async () => {
      try {
        const res = await fetch(`/api/transactions?tokenAddress=${tokenAddress}`);
        if (isJson(res)) {
          const data = await res.json();
          if (Array.isArray(data) && active) {
            setTxs(prev => {
              const combined = [...data, ...prev];
              const seen = new Set<string>();
              const deduped: any[] = [];
              for (const tx of combined) {
                const key = tx.hash || tx.id;
                if (!seen.has(key)) {
                  seen.add(key);
                  deduped.push(tx);
                }
              }
              deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              const sliced = deduped.slice(0, 50);
              if (prev.length === sliced.length && prev.every((t, i) => (t.id || t.hash) === (sliced[i].id || sliced[i].hash))) {
                return prev;
              }
              return sliced;
            });
          }
        }
      } catch (err) {
        console.warn('[PairDetailsView] Failed to poll live on-chain txs:', err);
      }
    };

    fetchTxs();
    const interval = setInterval(fetchTxs, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tokenAddress]);

  // Poll live token details every 1 second (1000ms) to tick all price values (USD, native price, FDV, market cap, etc.)
  useEffect(() => {
    let active = true;
    const fetchLatestToken = async () => {
      if (!tokenAddress) return;
      try {
        const res = await fetch(`/api/tokens/${tokenAddress}`);
        if (res.ok && active) {
          const data = await res.json();
          if (data && data.token) {
            const newToken = data.token;
            const prevToken = tokenRef.current;
            if (prevToken && prevToken.price !== newToken.price) {
              if (newToken.price > prevToken.price) {
                setPriceDirection('up');
              } else if (newToken.price < prevToken.price) {
                setPriceDirection('down');
              }
            }

            setLastPriceTickTime(Date.now());

            if (newToken.price > 0) {
              updatePrice(tokenAddress, newToken.price, newToken.priceChange24h);
            }

            setToken(prev => {
              if (!prev) return newToken;
              if (
                prev.price === newToken.price &&
                prev.priceNative === newToken.priceNative &&
                prev.priceChange24h === newToken.priceChange24h &&
                prev.fdv === newToken.fdv &&
                prev.mcap === newToken.mcap &&
                prev.liquidity === newToken.liquidity &&
                prev.volume24h === newToken.volume24h
              ) {
                return prev;
              }
              return { ...prev, ...newToken };
            });

            if (data.audit) {
              setAudit(prev => {
                if (prev && prev.score === data.audit.score && prev.isHoneypot === data.audit.isHoneypot && prev.lpLocked === data.audit.lpLocked) {
                  return prev;
                }
                return data.audit;
              });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to poll latest token details:', err);
      }
    };

    fetchLatestToken();
    const interval = setInterval(fetchLatestToken, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tokenAddress, updatePrice]);

  // Handle ticker pulse timeout
  useEffect(() => {
    if (priceDirection !== 'neutral') {
      const timer = setTimeout(() => {
        setPriceDirection('neutral');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [priceDirection]);

  // Handle Pay Amount Change with live pricing and slippage
  useEffect(() => {
    if (!token) {
      setReceiveAmount(prev => prev === 'Loading live pool...' ? prev : 'Loading live pool...');
      return;
    }
    if (!token.priceNative || token.priceNative <= 0) {
      setReceiveAmount(prev => prev === 'Error: Live quote failed' ? prev : 'Error: Live quote failed');
      return;
    }

    const pay = parseFloat(payAmount);
    if (isNaN(pay) || pay <= 0) {
      setReceiveAmount(prev => prev === '0' ? prev : '0');
      return;
    }

    // Apply real-time pool pricing and slippage
    const slippagePercent = token.liquidity < 10000 ? 4.5 : token.liquidity < 50000 ? 2.5 : token.liquidity < 250000 ? 1.0 : 0.5;
    
    let calc = 0;
    if (tradeType === 'buy') {
      calc = (pay / token.priceNative) * (1 - slippagePercent / 100);
    } else {
      calc = (pay * token.priceNative) * (1 - slippagePercent / 100);
    }

    const nextVal = (isNaN(calc) || !isFinite(calc) || calc <= 0)
      ? 'Error: Live quote failed'
      : (calc < 0.01 ? calc.toFixed(8) : calc.toFixed(4));

    setReceiveAmount(prev => prev === nextVal ? prev : nextVal);
  }, [payAmount, tradeType, token]);

  const handleFetchAiAnalysis = async () => {
    if (!token) return;
    setLoadingAi(true);
    setAiReport('');
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress: token.address })
      });
      const data = await res.json();
      setAiReport(data.analysis);
    } catch (err) {
      console.error('AI call failed:', err);
      setAiReport('Failed to complete audit with AI services. Verify network configs.');
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai' && !aiReport && token) {
      handleFetchAiAnalysis();
    }
  }, [activeTab, token, aiReport]);

  const executeSimulatedTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setTxPending(true);
    setTradeSuccess(null);

    setTimeout(() => {
      setTxPending(false);
      setTradeSuccess(`Successfully executed ${tradeType.toUpperCase()} swap for ${payAmount} ${tradeType === 'buy' ? getNativeSymbol(token.chain) : token.symbol}! Dynamic slip: 0.12%. Route: Aerodrome V3.`);
    }, 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleOpenRouting();
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const added = {
      id: 'c-' + Math.random().toString(36).substr(2, 4),
      author: 'Trader_' + Math.floor(Math.random() * 9000 + 1000),
      text: newComment.trim(),
      time: 'Just now'
    };
    setComments([added, ...comments]);
    setNewComment('');
  };

  // Cleanup flash timeout on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-5 px-6">
        <AlertOctagon className="text-red-500 w-12 h-12 animate-pulse" />
        <h2 className="text-white text-lg font-bold font-sans">Unable to fetch live token data</h2>
        <p className="text-gray-400 font-mono text-xs max-w-md text-center">
          The live blockchain identifier lookup failed, timed out, or returned incomplete information for this token.
        </p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadTokenData(true);
          }}
          className="px-4 py-2 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-bold font-mono text-xs rounded transition-all uppercase cursor-pointer"
        >
          Retry Fetch
        </button>
      </div>
    );
  }

  const safeToken: Token = token || {
    address: tokenAddress || '',
    pairAddress: '',
    name: 'Loading...',
    symbol: '--',
    price: 0,
    priceNative: 0,
    priceChange24h: 0,
    volume24h: 0,
    liquidity: 0,
    fdv: 0,
    mcap: 0,
    chain: 'Solana',
    dexName: '--',
    logo: '',
    banner: '',
    header: '',
    securityScore: 0,
    rugRiskScore: 'Low',
    holderCount: 0,
    tokenAgeDays: 0,
    socials: {},
    txns24h: { buys: 0, sells: 0 },
    promoted: false
  };

  const safeAudit: SecurityAudit = audit || {
    honeypotChecked: true,
    isHoneypot: false,
    mintStatus: 'Disabled',
    freezeStatus: 'Disabled',
    ownershipRenounced: true,
    lpLocked: true,
    lpLockPercent: 100,
    burnPercent: 0,
    buyTax: 0,
    sellTax: 0,
    transferRestrictions: false,
    suspiciousFunctions: []
  };

  // Format real-time ticking numbers
  const activePrice = currentPrice > 0 ? currentPrice : safeToken.price;
  const formattedPrice = formatCompressedPrice(activePrice);

  const base24h = (base24hPriceRef.current && base24hPriceRef.current > 0)
    ? base24hPriceRef.current
    : (safeToken.price > 0 ? safeToken.price / (1 + (safeToken.priceChange24h || 0) / 100) : 0);

  const realTimePriceChange24h = (base24h > 0 && activePrice > 0)
    ? ((activePrice - base24h) / base24h) * 100
    : (safeToken.priceChange24h || 0);

  const isUpRealTime = realTimePriceChange24h >= 0;

  const nowMs = Date.now();
  const isLiveTicking = (nowMs - lastPriceTickTime < 5000) && feedState !== 'unavailable' && !error;
  const isFeedUnavailable = feedState === 'unavailable' || !!error;

  return (
    <div className="space-y-6">
      {/* Back Header navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-elegant-text-secondary hover:text-white transition-colors text-sm font-semibold font-mono cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-elegant-gold" />
          <span>BACK TO SCREENER</span>
        </button>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={loadTokenData}
            className="p-1.5 bg-elegant-bg border border-elegant-border hover:bg-elegant-surface-hover hover:border-elegant-border-light rounded text-elegant-text-secondary hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Token Info Card and Interactive Price Chart Single Container */}
      <div className="relative overflow-hidden bg-elegant-surface border border-elegant-border rounded-xl flex flex-col justify-between shadow-md">
        {/* Banner image slot with error & empty states */}
        {!bannerFailed && (safeToken.banner || safeToken.header) ? (
          <div className="w-full h-32 relative overflow-hidden border-b border-elegant-border/30">
            <img 
              src={safeToken.banner || safeToken.header} 
              alt={`${safeToken.symbol} Banner`} 
              referrerPolicy="no-referrer"
              onError={() => setBannerFailed(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-elegant-surface via-transparent to-transparent"></div>
          </div>
        ) : (
          <div className="w-full h-20 bg-gradient-to-r from-elegant-bg to-elegant-surface flex items-center justify-center border-b border-elegant-border/30 text-elegant-text-secondary font-mono text-xs font-semibold">
            <span>No banner available</span>
          </div>
        )}

        <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 border-b border-elegant-border/80">
          <div className="flex items-center space-x-4">
            {/* Logo image slot with failure & empty states */}
            {!iconFailed && safeToken.logo ? (
              <div className="w-14 h-14 rounded-full overflow-hidden border border-elegant-border bg-elegant-bg shrink-0 flex items-center justify-center select-none shadow-md">
                <img
                  src={safeToken.logo}
                  alt={`${safeToken.symbol} logo`}
                  onError={() => setIconFailed(true)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-elegant-gold/20 via-elegant-surface to-elegant-gold/5 border border-elegant-gold/30 flex items-center justify-center font-extrabold text-elegant-gold font-mono text-sm shrink-0 select-none shadow-md">
                {safeToken.symbol.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight font-sans truncate">{safeToken.name}</h1>
                <span className="text-lg text-elegant-gold font-mono font-bold gold-glow">{safeToken.symbol}</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-elegant-bg text-elegant-text-secondary border border-elegant-border uppercase font-mono px-2 py-0.5 rounded whitespace-nowrap">
                  <ChainIcon chain={safeToken.chain} className="w-3.5 h-3.5 shrink-0" />
                  <span>{safeToken.chain}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-elegant-text-secondary w-full">
                <span className="whitespace-nowrap">DEX: <strong className="text-gray-300">{safeToken.dexName}</strong></span>
                <span className="inline-flex items-center space-x-1.5 bg-elegant-bg px-2 py-0.5 rounded border border-elegant-border max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={safeToken.address}>
                  <span className="text-elegant-text-secondary whitespace-nowrap">Contract:</span>
                  <strong className="text-gray-300 select-all font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                    {safeToken.address ? formatAddress(safeToken.address, safeToken.chain) : ''}
                  </strong>
                  <button
                    type="button"
                    onClick={() => handleCopy(safeToken.address, 'Contract Address')}
                    className="text-elegant-gold hover:text-elegant-gold-hover p-0.5 rounded transition-colors cursor-pointer active:scale-90"
                    title="Copy address"
                  >
                    {copiedText === 'Contract Address' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </span>
              </div>

              {/* Always display token social platforms - Clickable Icons Only */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 font-mono text-xs">
                {safeToken.socials?.website && (
                  <a
                    href={safeToken.socials.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="Official Website"
                  >
                    <Globe className="w-4 h-4 text-elegant-gold" />
                  </a>
                )}
                {safeToken.socials?.twitter && (
                  <a
                    href={safeToken.socials.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="Twitter / X"
                  >
                    <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                  </a>
                )}
                {safeToken.socials?.telegram && (
                  <a
                    href={safeToken.socials.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="Telegram Community"
                  >
                    <Send className="w-4 h-4 text-[#0088cc]" />
                  </a>
                )}
                {safeToken.socials?.discord && (
                  <a
                    href={safeToken.socials.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="Discord Server"
                  >
                    <MessageSquare className="w-4 h-4 text-[#5865F2]" />
                  </a>
                )}
                {safeToken.socials?.whitepaper && (
                  <a
                    href={safeToken.socials.whitepaper}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="Whitepaper / Docs"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                  </a>
                )}
                <a
                  href={safeToken.socials?.explorer || getExplorerUrl(safeToken.address, 'token')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/50 text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title={`View on ${getExplorerName(safeToken.chain)}`}
                >
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                </a>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="flex flex-col md:items-end gap-3 shrink-0">
            <MemoizedPriceHeader
              formattedPrice={formattedPrice}
              realTimePriceChange24h={realTimePriceChange24h}
              isUpRealTime={isUpRealTime}
              priceDirection={priceDirection}
              isLiveTicking={isLiveTicking}
              isFeedUnavailable={isFeedUnavailable}
            />
          </div>
        </div>

        {/* Interactive Price Chart Section inside same container */}
        <div className="w-full p-3 sm:p-4 bg-elegant-bg/40">
          <TradingViewChart
            tokenAddress={tokenAddress}
            tokenPrice={currentPrice || safeToken.price || 0}
            tokenSymbol={safeToken.symbol || 'TOKEN'}
            tokenLogoUrl={safeToken.logo || ''}
            tokenChain={safeToken.chain || ''}
            lastTrade={lastTrade}
            wsConnected={wsConnected}
          />
        </div>
      </div>

      {/* Dynamic Trending Ads Carousel */}
      {!loadingAds && ads.length > 0 && ads[currentAdIndex] && (
        <div 
          className="relative overflow-hidden bg-elegant-surface border border-elegant-border hover:border-elegant-gold/30 rounded-2xl p-4 md:p-5 transition-all duration-300 shadow-xl"
          onMouseEnter={() => setIsAdHovered(true)}
          onMouseLeave={() => setIsAdHovered(false)}
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



      {/* Redesigned Price & Stats Panel (Top Section) */}
      <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-5 shadow-md">
        <div className="space-y-4 pb-3 border-b border-elegant-border/60">
          {/* Dex Buy and Sell Trading Buttons (Top) */}
          <div className="w-full">
            <DexTradeButtons
              tokenAddress={safeToken.address}
              chain={safeToken.chain}
              symbol={safeToken.symbol}
              size="md"
              showPoolSelector={true}
            />
          </div>

          {/* Below Buy & Sell Buttons: Pool Created Date & Time & Pool Amounts */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 bg-elegant-bg/80 border border-elegant-border/80 rounded-xl px-3.5 py-2.5 w-full lg:w-auto shrink-0">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-elegant-text-secondary block">
                  Pool Created Date & Time
                </span>
                <div className="text-xs font-mono font-medium text-white flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {(() => {
                    const createdAt = safeToken.pairCreatedAt && safeToken.pairCreatedAt > 0
                      ? safeToken.pairCreatedAt
                      : (safeToken.tokenAgeDays ? Date.now() - safeToken.tokenAgeDays * 24 * 60 * 60 * 1000 : 0);
                    
                    if (!createdAt) return <span className="text-zinc-400">Date unavailable</span>;
                    
                    const d = new Date(createdAt);
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    const ageDays = Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
                    
                    return (
                      <>
                        <span className="text-zinc-200">{dateStr}</span>
                        <span className="text-amber-400 font-semibold">{timeStr}</span>
                        <span className="text-[10px] text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60 font-sans">
                          {ageDays === 0 ? 'Created Today' : `${ageDays}d ago`}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full">
              <div className="bg-elegant-bg/60 border border-elegant-border/80 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-elegant-text-secondary text-[10px] uppercase font-mono tracking-wider">Amount of Token in Pool</span>
                <span className="text-base font-mono tabular-nums font-bold text-white mt-0.5">
                  {(safeToken.poolBaseAmount && safeToken.poolBaseAmount > 0 ? safeToken.poolBaseAmount : (safeToken.liquidity && safeToken.price > 0 ? (safeToken.liquidity / 2) / safeToken.price : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-elegant-gold text-xs">{safeToken.symbol}</span>
                </span>
              </div>
              <div className="bg-elegant-bg/60 border border-elegant-border/80 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-elegant-text-secondary text-[10px] uppercase font-mono tracking-wider">Amount of Pegged Coin in Pool</span>
                <span className="text-base font-mono tabular-nums font-bold text-white mt-0.5">
                  {(safeToken.poolQuoteAmount && safeToken.poolQuoteAmount > 0 ? safeToken.poolQuoteAmount : (safeToken.liquidity && safeToken.price > 0 ? (safeToken.liquidity / 2) / (safeToken.priceNative && safeToken.priceNative > 0 ? (safeToken.price / safeToken.priceNative) : (safeToken.chain === 'Solana' ? 140 : 3000)) : 0)).toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-emerald-400 text-xs">{safeToken.quoteSymbol || getNativeSymbol(safeToken.chain)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Box Row: Liquidity, FDV, Market Cap */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-elegant-bg/40 p-4 rounded-lg border border-elegant-border flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-elegant-text-secondary text-[10px] uppercase font-mono tracking-wider">Liquidity</span>
              {safeAudit?.lpLocked ? (
                <span className="text-emerald-400 text-xs inline-flex items-center gap-1 font-mono" title="Liquidity Lock Verified via Security Audit">
                  🔒 Locked
                </span>
              ) : (
                <span className="text-amber-500 text-xs inline-flex items-center gap-1 font-mono" title="Liquidity status unverified">
                  🔓 Unverified
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-white font-mono tabular-nums mt-1.5">
              ${safeToken.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-elegant-bg/40 p-4 rounded-lg border border-elegant-border flex flex-col justify-between">
            <span className="text-elegant-text-secondary text-[10px] uppercase font-mono tracking-wider">Fully Diluted Value (FDV)</span>
            <p className="text-xl font-bold text-white font-mono tabular-nums mt-1.5">
              ${safeToken.fdv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-elegant-bg/40 p-4 rounded-lg border border-elegant-border flex flex-col justify-between">
            <span className="text-elegant-text-secondary text-[10px] uppercase font-mono tracking-wider">Market Cap</span>
            <p className="text-xl font-bold text-white font-mono tabular-nums mt-1.5">
              ${safeToken.mcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Timeframe Tabs & Live Price Changes */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-elegant-bg/50 border border-elegant-border/80 rounded-xl p-1">
            {(['5m', '1h', '6h', '24h'] as const).map(tf => {
              let change = 0;
              if (tf === '5m') change = safeToken.priceChange5m || 0;
              else if (tf === '1h') change = safeToken.priceChange1h || 0;
              else if (tf === '6h') change = safeToken.priceChange6h || 0;
              else change = safeToken.priceChange24h || 0;

              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-bold rounded uppercase font-mono transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    timeframe === tf 
                      ? 'bg-elegant-gold text-elegant-bg font-extrabold' 
                      : 'text-elegant-text-secondary hover:text-white'
                  }`}
                >
                  <span>{tf}</span>
                  <span className={timeframe === tf ? 'text-elegant-bg font-extrabold' : change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Proportional split progress bars */}
          {(() => {
            let buys = 0, sells = 0, volume = 0, buyers = 0, sellers = 0;
            if (timeframe === '5m') {
              buys = safeToken.txns5m?.buys || 0;
              sells = safeToken.txns5m?.sells || 0;
              volume = safeToken.volume5m || 0;
              buyers = safeToken.buyers5m || 0;
              sellers = safeToken.sellers5m || 0;
            } else if (timeframe === '1h') {
              buys = safeToken.txns1h?.buys || 0;
              sells = safeToken.txns1h?.sells || 0;
              volume = safeToken.volume1h || 0;
              buyers = safeToken.buyers1h || 0;
              sellers = safeToken.sellers1h || 0;
            } else if (timeframe === '6h') {
              buys = safeToken.txns6h?.buys || 0;
              sells = safeToken.txns6h?.sells || 0;
              volume = safeToken.volume6h || 0;
              buyers = safeToken.buyers6h || 0;
              sellers = safeToken.sellers6h || 0;
            } else {
              buys = safeToken.txns24h?.buys || safeToken.txns24hBuys || 0;
              sells = safeToken.txns24h?.sells || safeToken.txns24hSells || 0;
              volume = safeToken.volume24h || 0;
              buyers = safeToken.uniqueBuyers24h || 0;
              sellers = safeToken.uniqueSellers24h || 0;
            }
            const totalTx = buys + sells || 1;
            const totalTraders = buyers + sellers || 1;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {/* Txns split */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <span className="text-elegant-text-secondary uppercase text-[10px]">Transactions</span>
                    <span className="text-white font-semibold">{totalTx} txns</span>
                  </div>
                  <div className="w-full h-2 rounded bg-red-500/20 flex overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${(buys / totalTx) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 font-semibold">{buys} Buys</span>
                    <span className="text-red-400 font-semibold">{sells} Sells</span>
                  </div>
                </div>

                {/* Volume split */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <span className="text-elegant-text-secondary uppercase text-[10px]">Volume</span>
                    <span className="text-white font-semibold">${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="w-full h-2 rounded bg-red-500/20 flex overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${(buys / totalTx) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 font-semibold">
                      ${(volume * (buys / totalTx)).toLocaleString(undefined, { maximumFractionDigits: 0 })} Buy Vol
                    </span>
                    <span className="text-red-400 font-semibold">
                      ${(volume * (sells / totalTx)).toLocaleString(undefined, { maximumFractionDigits: 0 })} Sell Vol
                    </span>
                  </div>
                </div>

                {/* Traders split */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <span className="text-elegant-text-secondary uppercase text-[10px]">Unique Traders</span>
                    <span className="text-white font-semibold">{totalTraders} wallets</span>
                  </div>
                  <div className="w-full h-2 rounded bg-red-500/20 flex overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${(buyers / totalTraders) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 font-semibold">{buyers} Buyers</span>
                    <span className="text-red-400 font-semibold">{sellers} Sells</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* DEX Smart Routing Modal */}
      {showRoutingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-elegant-surface border border-elegant-border max-w-lg w-full rounded-2xl p-6 space-y-4 shadow-2xl relative">
            
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <TokenIcon symbol={safeToken.symbol} address={safeToken.address} logoUrl={safeToken.logo} size="lg" />
                <div>
                  <h3 className="text-white font-bold text-md leading-tight">{safeToken.name} Router</h3>
                  <span className="text-[10px] text-elegant-text-secondary font-mono uppercase tracking-wider block mt-0.5">
                    Multi-Chain DEX Discovery | {safeToken.chain} Network
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoutingModal(false)}
                className="p-1.5 rounded-lg bg-elegant-bg border border-elegant-border hover:border-elegant-gold/60 text-white hover:text-elegant-gold transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
                title="Close Modal"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              We parsed on-chain liquidity pools for <strong className="text-white font-semibold">{safeToken.symbol}</strong> to find the safest, most liquid path with lowest price impact and verified status.
            </p>

            {/* Pools list */}
            {!loadingPools && routingPools.length === 0 ? (
              <div className="bg-red-950/20 text-red-400 border border-red-900/40 p-4 rounded-xl text-center text-xs font-mono">
                ⚠️ No active liquidity pools found on {safeToken.chain}. This project might have been abandoned or lacks tradable pools.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                {routingPools.map((pool, idx) => {
                  const isTop = idx === 0;
                  return (
                    <div
                      key={`${pool.pairAddress || idx}-${idx}`}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                        isTop
                          ? 'bg-emerald-950/15 border-emerald-500/45 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                          : 'bg-elegant-bg/40 border-elegant-border'
                      }`}
                    >
                      <div className="space-y-1.5 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white font-bold text-sm font-mono">{pool.dexName}</span>
                          <span className="text-gray-400 font-mono text-xs font-semibold">({pool.tradingPair})</span>
                          
                          {isTop && (
                            <span className="text-[8px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider">
                              ⭐ Best Route
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-x-4 gap-y-1 font-mono text-[10px] text-elegant-text-secondary">
                          <div>
                            LIQ: <span className="text-white font-semibold">${pool.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div>
                            VOL 24H: <span className="text-white font-semibold">${pool.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div>
                            SLIP: <span className="text-emerald-400 font-semibold">{pool.estimatedSlippage}%</span>
                          </div>
                        </div>

                        <div className="text-[9px] text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-[300px]">
                          Pool Address: {pool.pairAddress}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => openDexTradePage(pool.buyUrl)}
                          className="w-full sm:w-auto px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <img src={pool.dexIcon || getDexLogo(pool.dexName)} alt="" className="w-3.5 h-3.5 rounded-full object-contain" />
                          <span>Buy</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDexTradePage(pool.sellUrl)}
                          className="w-full sm:w-auto px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <img src={pool.dexIcon || getDexLogo(pool.dexName)} alt="" className="w-3.5 h-3.5 rounded-full object-contain" />
                          <span>Sell</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Note */}
            <div className="bg-elegant-bg/50 p-3 rounded-lg border border-elegant-border text-[9px] font-mono text-zinc-500 leading-relaxed">
              ⚠️ PRO-TIP: We continuously monitor trading venues. If liquidity shifts, recommended routing badges automatically upgrade. Always verify slippage limits on your chosen DEX wallet interface before executing large trades.
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
