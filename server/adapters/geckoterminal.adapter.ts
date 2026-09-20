import { Candle } from '../../src/types';
import { monitoringService } from '../services/monitoring.service';

export class GeckoTerminalAdapter {
  private baseUrl = 'https://api.geckoterminal.com/api/v2';
  private cache = new Map<string, { data: Candle[]; expiry: number }>();

  private resolveNetwork(chain: string): string {
    const c = (chain || '').toLowerCase();
    if (c === 'solana') return 'solana';
    if (c === 'base') return 'base';
    if (c === 'bsc' || c === 'bnb chain' || c === 'bnb') return 'bsc';
    if (c === 'arbitrum') return 'arbitrum';
    if (c === 'avalanche' || c === 'avax') return 'avax';
    return 'eth';
  }

  public async getOHLCV(chain: string, poolAddress: string, timeframe: string): Promise<Candle[]> {
    const cleanPool = poolAddress.trim();
    if (!cleanPool || cleanPool.endsWith('-pair') || cleanPool.endsWith('-pool')) {
      return [];
    }

    const network = this.resolveNetwork(chain);
    const cacheKey = `${network}_${cleanPool}_${timeframe}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Map timeframe string to GeckoTerminal timeframe parameter
    let gtTimeframe = 'hour';
    let aggregate = 1;
    let limit = 120;

    switch (timeframe) {
      case '1m':
        gtTimeframe = 'minute';
        aggregate = 1;
        break;
      case '5m':
        gtTimeframe = 'minute';
        aggregate = 5;
        break;
      case '15m':
        gtTimeframe = 'minute';
        aggregate = 15;
        break;
      case '1h':
        gtTimeframe = 'hour';
        aggregate = 1;
        break;
      case '4h':
        gtTimeframe = 'hour';
        aggregate = 4;
        break;
      case '1d':
        gtTimeframe = 'day';
        aggregate = 1;
        break;
      default:
        gtTimeframe = 'hour';
        aggregate = 1;
    }

    const url = `${this.baseUrl}/networks/${network}/pools/${cleanPool}/ohlcv/${gtTimeframe}?aggregate=${aggregate}&limit=${limit}`;
    const startTime = Date.now();

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json;version=20230302',
          'User-Agent': 'SURCHI-Analytics/2.0'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.status === 429) {
        monitoringService.recordFailure('GeckoTerminal', new Error('Rate limit 429'), true);
        return cached ? cached.data : [];
      }

      if (!res.ok) {
        throw new Error(`GeckoTerminal status ${res.status}`);
      }

      const json = await res.json();
      const ohlcvList = json?.data?.attributes?.ohlcv_list;

      if (!Array.isArray(ohlcvList) || ohlcvList.length === 0) {
        return [];
      }

      // GeckoTerminal format: [timestamp, open, high, low, close, volume]
      const candles: Candle[] = ohlcvList
        .map((item: any[]) => ({
          time: Number(item[0]),
          open: Number(item[1]),
          high: Number(item[2]),
          low: Number(item[3]),
          close: Number(item[4]),
          volume: Number(item[5] || 0)
        }))
        .filter((c: Candle) => !isNaN(c.time) && !isNaN(c.close) && c.close > 0)
        .sort((a: Candle, b: Candle) => a.time - b.time);

      monitoringService.recordSuccess('GeckoTerminal', Date.now() - startTime);
      this.cache.set(cacheKey, { data: candles, expiry: Date.now() + 60000 }); // 60s cache
      return candles;
    } catch (err: any) {
      monitoringService.recordFailure('GeckoTerminal', err, err?.message?.includes('429'));
      return cached ? cached.data : [];
    }
  }
}

export const geckoTerminalAdapter = new GeckoTerminalAdapter();
