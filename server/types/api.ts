import type { Token, Candle, Transaction, SmartWhaleTransaction, SmartWhaleProfile, SecurityAudit, Chain } from '../../src/types';
export type { Token, Candle, Transaction, SmartWhaleTransaction, SmartWhaleProfile, SecurityAudit, Chain };

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    provider: string;
    timestamp: number;
    cached?: boolean;
    latencyMs?: number;
  };
}

export type ProviderStatus = 'operational' | 'degraded' | 'unavailable';

export interface ProviderHealth {
  name: string;
  category: 'market' | 'solana' | 'ai' | 'security';
  status: ProviderStatus;
  latencyMs: number;
  lastSuccess: number;
  errorCount: number;
  rateLimited: boolean;
  endpoint: string;
}

export interface MarketOverviewData {
  totalMarketCapUSD: number;
  totalVolume24hUSD: number;
  btcDominance: number;
  ethDominance: number;
  solDominance: number;
  solPriceUSD: number;
  ethPriceUSD: number;
  fearGreedIndex: {
    value: number;
    classification: string;
  };
  gasPrices: {
    ethereumGwei: number;
    solanaLamports: number;
  };
  chainStats: Array<{
    chain: Chain;
    volume24h: number;
    txsCount24h: number;
    activeWallets: number;
    avgGasPriceGwei: number;
    tvl: number;
  }>;
}

export interface DexPoolInfo {
  id: string;
  dexId: string;
  dexName: string;
  chain: string;
  poolAddress: string;
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
    name: string;
  };
  priceUSD: number;
  liquidityUSD: number;
  volume24hUSD: number;
  feePercent?: number;
  poolUrl?: string;
  tradeUrl?: string;
}
