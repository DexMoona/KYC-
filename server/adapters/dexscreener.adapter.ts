import { Token, Chain, DexStreamTransaction, Transaction } from '../../src/types';
import { monitoringService } from '../services/monitoring.service';

export class DexScreenerAdapter {
  private baseUrl = 'https://api.dexscreener.com';
  private cache = new Map<string, { data: any; expiry: number }>();

  private resolveChain(chainId: string): Chain {
    const lower = (chainId || '').toLowerCase();
    if (lower === 'solana') return 'Solana';
    if (lower === 'bsc' || lower === 'bnb') return 'BNB Chain';
    if (lower === 'base') return 'Base';
    if (lower === 'arbitrum') return 'Arbitrum';
    if (lower === 'avalanche' || lower === 'avax') return 'Avalanche';
    return 'Ethereum';
  }

  private resolveDexName(dexId: string, chain: string): string {
    const d = (dexId || '').toLowerCase();
    const c = (chain || '').toLowerCase();
    if (d.includes('uniswap')) return 'Uniswap';
    if (d.includes('pancake')) return 'PancakeSwap';
    if (d.includes('raydium')) return 'Raydium';
    if (d.includes('orca')) return 'Orca';
    if (d.includes('meteora')) return 'Meteora';
    if (d.includes('pump')) return 'Pump.fun';
    if (d.includes('aerodrome')) return 'Aerodrome';
    if (d.includes('traderjoe') || d.includes('joe')) return 'Trader Joe';
    if (d.includes('sushiswap') || d.includes('sushi')) return 'SushiSwap';
    if (c === 'solana') return 'Raydium';
    if (c === 'base') return 'Aerodrome';
    if (c === 'bnb chain' || c === 'bsc') return 'PancakeSwap';
    return 'Uniswap v3';
  }

  public mapPairToToken(pair: any, isPromoted = false): Token {
    const chain = this.resolveChain(pair.chainId);
    const dexName = this.resolveDexName(pair.dexId, chain);
    const priceUsd = parseFloat(pair.priceUsd) || 0;
    const priceNative = parseFloat(pair.priceNative) || 0;
    const priceChange24h = pair.priceChange?.h24 ? parseFloat(pair.priceChange.h24) : 0;
    const priceChange1h = pair.priceChange?.h1 ? parseFloat(pair.priceChange.h1) : 0;
    const priceChange5m = pair.priceChange?.m5 ? parseFloat(pair.priceChange.m5) : 0;
    const priceChange6h = pair.priceChange?.h6 ? parseFloat(pair.priceChange.h6) : 0;
    const volume24h = pair.volume?.h24 ? parseFloat(pair.volume.h24) : 0;
    const liquidity = pair.liquidity?.usd ? parseFloat(pair.liquidity.usd) : 0;
    const mcap = pair.marketCap || pair.fdv || (liquidity * 2.5);
    const fdv = pair.fdv || mcap;

    const txns24hBuys = pair.txns?.h24?.buys || 0;
    const txns24hSells = pair.txns?.h24?.sells || 0;
    const txns1hBuys = pair.txns?.h1?.buys || 0;
    const txns1hSells = pair.txns?.h1?.sells || 0;
    const txns5mBuys = pair.txns?.m5?.buys || 0;
    const txns5mSells = pair.txns?.m5?.sells || 0;
    const txns6hBuys = pair.txns?.h6?.buys || 0;
    const txns6hSells = pair.txns?.h6?.sells || 0;

    const buyers24h = pair.buyers?.h24 || 0;
    const sellers24h = pair.sellers?.h24 || 0;

    let tokenAgeDays = 30;
    if (pair.pairCreatedAt) {
      const diffMs = Date.now() - pair.pairCreatedAt;
      tokenAgeDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Dynamic security scoring based on liquidity, volume, and pair age
    let securityScore = 75;
    if (liquidity > 250000) securityScore += 10;
    if (liquidity < 20000) securityScore -= 15;
    if (tokenAgeDays > 60) securityScore += 10;
    if (tokenAgeDays < 2) securityScore -= 15;
    if (volume24h > 100000) securityScore += 5;
    securityScore = Math.max(20, Math.min(99, securityScore));

    let rugRiskScore: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
    if (securityScore < 40) rugRiskScore = 'Critical';
    else if (securityScore < 60) rugRiskScore = 'High';
    else if (securityScore < 78) rugRiskScore = 'Medium';

    const socialsObj: any = {};
    if (Array.isArray(pair.info?.socials)) {
      for (const s of pair.info.socials) {
        if (s.type === 'twitter') socialsObj.twitter = s.url;
        if (s.type === 'telegram') socialsObj.telegram = s.url;
        if (s.type === 'discord') socialsObj.discord = s.url;
      }
    }
    if (Array.isArray(pair.info?.websites) && pair.info.websites.length > 0) {
      socialsObj.website = pair.info.websites[0].url;
    }

    return {
      address: pair.baseToken.address,
      pairAddress: pair.pairAddress,
      name: pair.baseToken.name || 'Unknown Token',
      symbol: pair.baseToken.symbol || 'UNK',
      chain,
      price: priceUsd,
      priceNative,
      priceChange1h,
      priceChange24h,
      priceChange5m,
      priceChange6h,
      volume24h,
      liquidity,
      mcap,
      fdv,
      circulatingSupply: priceUsd > 0 ? Math.round(mcap / priceUsd) : 1000000000,
      holderCount: 0, // Filled by on-chain / indexer if available
      topHolders: [],
      creatorWallet: pair.pairAddress ? pair.pairAddress.slice(0, 8) + '...' : '',
      tokenAgeDays,
      dexName,
      verified: isPromoted || (liquidity > 150000 && volume24h > 50000),
      promoted: isPromoted,
      logo: pair.info?.imageUrl || '',
      banner: pair.info?.header || '',
      header: pair.info?.header || '',
      securityScore,
      rugRiskScore,
      lastUpdated: Date.now(),
      quoteSymbol: pair.quoteToken?.symbol,
      quoteAddress: pair.quoteToken?.address,
      txns24hBuys,
      txns24hSells,
      uniqueBuyers24h: buyers24h,
      uniqueSellers24h: sellers24h,
      txns5m: { buys: txns5mBuys, sells: txns5mSells },
      txns1h: { buys: txns1hBuys, sells: txns1hSells },
      txns6h: { buys: txns6hBuys, sells: txns6hSells },
      txns24h: { buys: txns24hBuys, sells: txns24hSells },
      volume5m: pair.volume?.m5 || 0,
      volume1h: pair.volume?.h1 || 0,
      volume6h: pair.volume?.h6 || 0,
      buyers5m: pair.buyers?.m5 || 0,
      sellers5m: pair.sellers?.m5 || 0,
      buyers1h: pair.buyers?.h1 || 0,
      sellers1h: pair.sellers?.h1 || 0,
      buyers6h: pair.buyers?.h6 || 0,
      sellers6h: pair.sellers?.h6 || 0,
      buyers24h,
      sellers24h,
      pairCreatedAt: pair.pairCreatedAt,
      socials: socialsObj
    };
  }

  public async fetchWithTimeout(url: string, timeoutMs = 6000): Promise<any> {
    const startTime = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SURCHI-Enterprise/2.0'
        },
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (res.status === 429) {
        monitoringService.recordFailure('DexScreener', new Error('Rate limit 429'), true);
        throw new Error('DexScreener rate limit (429)');
      }

      if (!res.ok) {
        throw new Error(`DexScreener HTTP error ${res.status}`);
      }

      const json = await res.json();
      monitoringService.recordSuccess('DexScreener', Date.now() - startTime);
      return json;
    } catch (err: any) {
      monitoringService.recordFailure('DexScreener', err, err?.message?.includes('429'));
      throw err;
    }
  }

  public async search(query: string): Promise<Token[]> {
    const q = query.trim();
    if (!q) return [];

    const cacheKey = `search_${q.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const data = await this.fetchWithTimeout(`${this.baseUrl}/latest/dex/search?q=${encodeURIComponent(q)}`, 5000);
      if (!data || !Array.isArray(data.pairs)) return [];

      const tokens = data.pairs.slice(0, 30).map((p: any) => this.mapPairToToken(p));
      this.cache.set(cacheKey, { data: tokens, expiry: Date.now() + 30000 }); // 30s cache
      return tokens;
    } catch (err) {
      return [];
    }
  }

  public async getTokensByAddress(address: string): Promise<Token[]> {
    const addr = address.trim();
    if (!addr) return [];

    const cacheKey = `tokens_${addr.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const data = await this.fetchWithTimeout(`${this.baseUrl}/latest/dex/tokens/${addr}`, 6000);
      if (!data || !Array.isArray(data.pairs)) return [];

      const tokens = data.pairs.map((p: any) => this.mapPairToToken(p));
      this.cache.set(cacheKey, { data: tokens, expiry: Date.now() + 15000 });
      return tokens;
    } catch (err) {
      return [];
    }
  }

  public async getPairByAddress(chain: string, pairAddress: string): Promise<any | null> {
    const cacheKey = `pair_${chain.toLowerCase()}_${pairAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const data = await this.fetchWithTimeout(`${this.baseUrl}/latest/dex/pairs/${chain}/${pairAddress}`, 6000);
      if (data && data.pair) {
        this.cache.set(cacheKey, { data: data.pair, expiry: Date.now() + 15000 });
        return data.pair;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  public async getTrendingSolanaTokens(): Promise<Token[]> {
    const cacheKey = 'solana_trending';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    // Fetch popular verified high-liquidity tokens on Solana
    const popularMints = [
      'So11111111111111111111111111111111111111112', // SOL
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcJM', // WIF
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      '7GCihgB12LwyLWr4R45awNG2Za6Hvge3A45C3612wrpt', // POPCAT
      'HZ1Jov3yDh2GJLwJJchP3nC4EMM4vEw665y5vE5e1E1E', // PYTH
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
      'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', // ORCA
      'MEFNBXixkEbait3xn9bkm8FsMeqEuzmeeYneDVGLbxj', // ME
      'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs'  // GRASS
    ];

    try {
      const data = await this.fetchWithTimeout(`${this.baseUrl}/latest/dex/tokens/${popularMints.join(',')}`, 8000);
      if (data && Array.isArray(data.pairs)) {
        // Group by base token, keep highest liquidity pair
        const bestPairMap = new Map<string, any>();
        for (const p of data.pairs) {
          if (p.chainId?.toLowerCase() !== 'solana') continue;
          const mint = p.baseToken?.address;
          if (!mint) continue;
          const existing = bestPairMap.get(mint);
          const liq = p.liquidity?.usd || 0;
          if (!existing || (liq > (existing.liquidity?.usd || 0))) {
            bestPairMap.set(mint, p);
          }
        }
        const tokens = Array.from(bestPairMap.values()).map(p => this.mapPairToToken(p));
        this.cache.set(cacheKey, { data: tokens, expiry: Date.now() + 20000 });
        return tokens;
      }
      return [];
    } catch (err) {
      return [];
    }
  }
}

export const dexScreenerAdapter = new DexScreenerAdapter();
