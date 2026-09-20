import { ProviderHealth, ProviderStatus } from '../types/api';

class MonitoringService {
  private providers: Map<string, ProviderHealth> = new Map();

  constructor() {
    this.registerProvider('DexScreener', 'market', 'https://api.dexscreener.com');
    this.registerProvider('GeckoTerminal', 'market', 'https://api.geckoterminal.com');
    this.registerProvider('CoinGecko', 'market', 'https://api.coingecko.com');
    this.registerProvider('Solana Mainnet RPC', 'solana', 'https://api.mainnet-beta.solana.com');
    this.registerProvider('RugCheck', 'security', 'https://api.rugcheck.xyz');
    this.registerProvider('Helius DAS', 'solana', 'https://mainnet.helius-rpc.com');
    this.registerProvider('Google Gemini AI', 'ai', 'https://generativelanguage.googleapis.com');
  }

  private registerProvider(name: string, category: ProviderHealth['category'], endpoint: string) {
    this.providers.set(name, {
      name,
      category,
      status: 'operational',
      latencyMs: 45,
      lastSuccess: Date.now(),
      errorCount: 0,
      rateLimited: false,
      endpoint
    });
  }

  public recordSuccess(name: string, latencyMs: number) {
    const p = this.providers.get(name);
    if (p) {
      p.status = latencyMs > 3000 ? 'degraded' : 'operational';
      p.latencyMs = Math.round(latencyMs);
      p.lastSuccess = Date.now();
      p.rateLimited = false;
    }
  }

  public recordFailure(name: string, err: any, isRateLimit = false) {
    const p = this.providers.get(name);
    if (p) {
      p.errorCount++;
      if (isRateLimit || err?.message?.includes('429')) {
        p.rateLimited = true;
        p.status = 'degraded';
      } else {
        p.status = p.errorCount > 3 ? 'unavailable' : 'degraded';
      }
    }
  }

  public getProvider(name: string): ProviderHealth | undefined {
    return this.providers.get(name);
  }

  public getAllProviders(): ProviderHealth[] {
    return Array.from(this.providers.values());
  }

  public getSystemSummary() {
    const all = this.getAllProviders();
    const operationalCount = all.filter(p => p.status === 'operational').length;
    const degradedCount = all.filter(p => p.status === 'degraded').length;
    const unavailableCount = all.filter(p => p.status === 'unavailable').length;

    let overallStatus: ProviderStatus = 'operational';
    if (unavailableCount > 1) overallStatus = 'unavailable';
    else if (unavailableCount > 0 || degradedCount > 0) overallStatus = 'degraded';

    const avgLatency = Math.round(
      all.reduce((acc, p) => acc + p.latencyMs, 0) / (all.length || 1)
    );

    return {
      overallStatus,
      totalProviders: all.length,
      operationalCount,
      degradedCount,
      unavailableCount,
      avgLatencyMs: avgLatency,
      providers: all,
      timestamp: Date.now()
    };
  }
}

export const monitoringService = new MonitoringService();
