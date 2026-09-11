import { fetchWithTimeoutAndRetry } from './api';

export interface DexPool {
  dexName: string;
  dexIcon?: string;
  liquidity: number;
  volume24h: number;
  pairAddress: string;
  poolAddress?: string;
  tradingPair: string;
  estimatedSlippage: number;
  verified: boolean;
  buyUrl: string;
  sellUrl: string;
  chainId: string;
}

export interface DexRoutingResult {
  pools: DexPool[];
  selectedPool: DexPool | null;
  loading: boolean;
  error: string | null;
  noPoolAvailable: boolean;
}

// In-memory route cache with TTL (45s)
interface CacheEntry {
  pools: DexPool[];
  timestamp: number;
}

const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 300000; // 5 minutes TTL (300,000 ms)

export function getDexLogo(dexName: string): string {
  const d = (dexName || '').toLowerCase();
  if (d.includes('raydium')) return 'https://assets.coingecko.com/markets/images/638/large/raydium.png';
  if (d.includes('orca')) return 'https://assets.coingecko.com/markets/images/684/large/orca.png';
  if (d.includes('meteora')) return 'https://assets.coingecko.com/markets/images/1283/large/meteora.png';
  if (d.includes('pump')) return 'https://pump.fun/favicon.ico';
  if (d.includes('jupiter')) return 'https://assets.coingecko.com/markets/images/1149/large/jupiter.png';
  if (d.includes('aerodrome')) return 'https://assets.coingecko.com/markets/images/1199/large/aerodrome.png';
  if (d.includes('pancakeswap') || d.includes('pancake')) return 'https://assets.coingecko.com/markets/images/561/large/pancakeswap.png';
  if (d.includes('camelot')) return 'https://assets.coingecko.com/markets/images/1004/large/camelot.png';
  if (d.includes('quickswap')) return 'https://assets.coingecko.com/markets/images/604/large/quickswap.png';
  if (d.includes('trader joe') || d.includes('traderjoe')) return 'https://assets.coingecko.com/markets/images/680/large/trader-joe.png';
  if (d.includes('sushi')) return 'https://assets.coingecko.com/markets/images/576/large/sushiswap.png';
  if (d.includes('uniswap')) return 'https://assets.coingecko.com/markets/images/1069/large/uniswap-v3.png';
  return 'https://assets.coingecko.com/markets/images/1069/large/uniswap-v3.png';
}

/**
 * Generate official DEX trading links for any given chain & DEX
 */
export function buildDexUrls(chain: string, dexName: string, tokenAddress: string): { buyUrl: string; sellUrl: string } {
  const c = (chain || '').toLowerCase();
  const d = (dexName || '').toLowerCase();
  const address = tokenAddress;

  if (d.includes('pump') || d.includes('pumpswap') || d.includes('pump.fun')) {
    return {
      buyUrl: `https://pump.fun/coin/${address}`,
      sellUrl: `https://pump.fun/coin/${address}`
    };
  }

  if (c.includes('solana') || c === 'sol') {
    if (d.includes('raydium')) {
      return {
        buyUrl: `https://raydium.io/swap/?inputMint=sol&outputMint=${address}`,
        sellUrl: `https://raydium.io/swap/?inputMint=${address}&outputMint=sol`
      };
    }
    if (d.includes('orca')) {
      return {
        buyUrl: `https://www.orca.so/?inputMint=sol&outputMint=${address}`,
        sellUrl: `https://www.orca.so/?inputMint=${address}&outputMint=sol`
      };
    }
    if (d.includes('meteora')) {
      return {
        buyUrl: `https://app.meteora.ag/swap?input=SOL&output=${address}`,
        sellUrl: `https://app.meteora.ag/swap?input=${address}&output=SOL`
      };
    }
    return {
      buyUrl: `https://jup.ag/swap/SOL-${address}`,
      sellUrl: `https://jup.ag/swap/${address}-SOL`
    };
  }

  if (c.includes('base')) {
    if (d.includes('uniswap')) {
      return {
        buyUrl: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${address}&chain=base`,
        sellUrl: `https://app.uniswap.org/#/swap?inputCurrency=${address}&outputCurrency=ETH&chain=base`
      };
    }
    return {
      buyUrl: `https://aerodrome.finance/swap?from=eth&to=${address}`,
      sellUrl: `https://aerodrome.finance/swap?from=${address}&to=eth`
    };
  }

  if (c.includes('bsc') || c.includes('bnb') || c.includes('binance')) {
    return {
      buyUrl: `https://pancakeswap.finance/swap?inputCurrency=BNB&outputCurrency=${address}`,
      sellUrl: `https://pancakeswap.finance/swap?inputCurrency=${address}&outputCurrency=BNB`
    };
  }

  if (c.includes('polygon') || c === 'matic') {
    if (d.includes('uniswap')) {
      return {
        buyUrl: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${address}&chain=polygon`,
        sellUrl: `https://app.uniswap.org/#/swap?inputCurrency=${address}&outputCurrency=ETH&chain=polygon`
      };
    }
    return {
      buyUrl: `https://quickswap.exchange/#/swap?inputCurrency=ETH&outputCurrency=${address}`,
      sellUrl: `https://quickswap.exchange/#/swap?inputCurrency=${address}&outputCurrency=ETH`
    };
  }

  if (c.includes('avalanche') || c === 'avax') {
    return {
      buyUrl: `https://traderjoexyz.com/avalanche/trade?inputCurrency=AVAX&outputCurrency=${address}`,
      sellUrl: `https://traderjoexyz.com/avalanche/trade?inputCurrency=${address}&outputCurrency=AVAX`
    };
  }

  if (c.includes('arbitrum')) {
    if (d.includes('camelot')) {
      return {
        buyUrl: `https://app.camelot.exchange/?token1=ETH&token2=${address}`,
        sellUrl: `https://app.camelot.exchange/?token1=${address}&token2=ETH`
      };
    }
    return {
      buyUrl: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${address}&chain=arbitrum`,
      sellUrl: `https://app.uniswap.org/#/swap?inputCurrency=${address}&outputCurrency=ETH&chain=arbitrum`
    };
  }

  if (c.includes('sui')) {
    return {
      buyUrl: `https://app.cetus.zone/swap?from=0x2::sui::SUI&to=${address}`,
      sellUrl: `https://app.cetus.zone/swap?from=${address}&to=0x2::sui::SUI`
    };
  }

  // Ethereum default
  if (d.includes('sushi')) {
    return {
      buyUrl: `https://www.sushi.com/swap?fromChainId=1&fromCurrency=NATIVE&toCurrency=${address}`,
      sellUrl: `https://www.sushi.com/swap?fromChainId=1&fromCurrency=${address}&toCurrency=NATIVE`
    };
  }

  return {
    buyUrl: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${address}&chain=mainnet`,
    sellUrl: `https://app.uniswap.org/#/swap?inputCurrency=${address}&outputCurrency=ETH&chain=mainnet`
  };
}

/**
 * Fetch and discover active liquidity pool routes for a given token address.
 * Caches results with TTL and verifies liquidity > 0.
 */
export async function fetchTokenPools(tokenAddress: string, chain?: string): Promise<{ pools: DexPool[]; error: string | null }> {
  if (!tokenAddress) {
    return { pools: [], error: 'Unable to locate a valid trading pool.' };
  }

  const cacheKey = `${tokenAddress.toLowerCase()}_${(chain || '').toLowerCase()}`;
  const cached = routeCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return { pools: cached.pools, error: null };
  }

  try {
    const res = await fetchWithTimeoutAndRetry(`/api/tokens/${tokenAddress}/pools`, {}, 10000, 2);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.pools) && data.pools.length > 0) {
        // Filter and verify pools with liquidity > 0
        const verifiedPools: DexPool[] = data.pools
          .filter((p: any) => p && typeof p.liquidity === 'number' && p.liquidity > 0 && (p.buyUrl || p.sellUrl))
          .map((p: any) => {
            const dexName = p.dexName || 'DEX Pool';
            const dexIcon = p.dexIcon || getDexLogo(dexName);
            const urls = p.buyUrl && p.sellUrl ? { buyUrl: p.buyUrl, sellUrl: p.sellUrl } : buildDexUrls(p.chainId || chain || 'Ethereum', dexName, tokenAddress);

            return {
              dexName,
              dexIcon,
              liquidity: p.liquidity || 0,
              volume24h: p.volume24h || 0,
              pairAddress: p.pairAddress || p.poolAddress || tokenAddress,
              poolAddress: p.poolAddress || p.pairAddress || tokenAddress,
              tradingPair: p.tradingPair || `${dexName} Pair`,
              estimatedSlippage: p.estimatedSlippage || 0.5,
              verified: p.verified !== false,
              buyUrl: urls.buyUrl,
              sellUrl: urls.sellUrl,
              chainId: p.chainId || chain || 'Ethereum'
            };
          });

        // Sort by liquidity descending (highest liquidity pool first)
        verifiedPools.sort((a, b) => b.liquidity - a.liquidity);

        if (verifiedPools.length > 0) {
          routeCache.set(cacheKey, { pools: verifiedPools, timestamp: now });
          return { pools: verifiedPools, error: null };
        }
      }
    }
  } catch (err) {
    console.warn(`[DexRouter] Error fetching pools for ${tokenAddress}:`, err);
  }

  return { pools: [], error: 'Unable to locate a valid trading pool.' };
}

/**
 * Open DEX trading link in a new browser tab
 */
export function openDexTradePage(url: string) {
  if (!url || url === '#') {
    console.error('[DexRouter] Invalid redirect URL provided');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
