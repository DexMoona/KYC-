import { monitoringService } from '../services/monitoring.service';

export class CoinGeckoAdapter {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private apiKey = process.env.COINGECKO_API_KEY || '';
  private cache = new Map<string, { data: any; expiry: number }>();
  private rateLimitedUntil = 0;

  private getEffectiveUrl(endpoint: string): string {
    const isPro = this.apiKey && this.apiKey.startsWith('CG-') && !this.apiKey.includes('placeholder');
    const base = isPro ? 'https://pro-api.coingecko.com/api/v3' : this.baseUrl;
    const separator = endpoint.includes('?') ? '&' : '?';
    if (this.apiKey && !this.apiKey.includes('placeholder')) {
      return `${base}${endpoint}${separator}x_cg_demo_api_key=${this.apiKey}`;
    }
    return `${base}${endpoint}`;
  }

  public async fetchWithBackoff(endpoint: string, timeoutMs = 5000): Promise<any> {
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      throw new Error('CoinGecko temporary rate limit cooldown');
    }

    const url = this.getEffectiveUrl(endpoint);
    const startTime = Date.now();

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SURCHI/2.0' },
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (res.status === 429) {
        this.rateLimitedUntil = Date.now() + 60000; // 60s cooldown
        monitoringService.recordFailure('CoinGecko', new Error('Rate limit 429'), true);
        throw new Error('CoinGecko rate limit (429)');
      }

      if (!res.ok) {
        throw new Error(`CoinGecko HTTP error ${res.status}`);
      }

      const json = await res.json();
      monitoringService.recordSuccess('CoinGecko', Date.now() - startTime);
      return json;
    } catch (err: any) {
      monitoringService.recordFailure('CoinGecko', err, err?.message?.includes('429'));
      throw err;
    }
  }

  public async getGlobalMarketStats(): Promise<any> {
    const cacheKey = 'coingecko_global';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const data = await this.fetchWithBackoff('/global', 4000);
      if (data && data.data) {
        const d = data.data;
        const result = {
          totalMarketCapUSD: d.total_market_cap?.usd || 0,
          totalVolume24hUSD: d.total_volume?.usd || 0,
          btcDominance: d.market_cap_percentage?.btc || 0,
          ethDominance: d.market_cap_percentage?.eth || 0,
          solDominance: d.market_cap_percentage?.sol || 0
        };
        this.cache.set(cacheKey, { data: result, expiry: Date.now() + 60000 }); // 60s
        return result;
      }
    } catch (e) {
      // Return cached fallback if available even if expired
      if (cached) return cached.data;
    }
    return null;
  }

  public async getTrending(): Promise<any[]> {
    const cacheKey = 'coingecko_trending';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const data = await this.fetchWithBackoff('/search/trending', 4000);
      if (data && Array.isArray(data.coins)) {
        const coins = data.coins.map((c: any) => ({
          id: c.item.id,
          name: c.item.name,
          symbol: c.item.symbol,
          marketCapRank: c.item.market_cap_rank,
          thumb: c.item.thumb,
          large: c.item.large,
          priceBtc: c.item.price_btc,
          score: c.item.score
        }));
        this.cache.set(cacheKey, { data: coins, expiry: Date.now() + 90000 }); // 90s
        return coins;
      }
    } catch (e) {
      if (cached) return cached.data;
    }
    return [];
  }

  public async getSimplePrices(ids: string[]): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
    if (!ids || ids.length === 0) return {};
    const key = `prices_${ids.sort().join(',')}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const data = await this.fetchWithBackoff(`/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`, 4000);
      if (data) {
        this.cache.set(key, { data, expiry: Date.now() + 30000 });
        return data;
      }
    } catch (e) {
      if (cached) return cached.data;
    }
    return {};
  }
}

export const coinGeckoAdapter = new CoinGeckoAdapter();
