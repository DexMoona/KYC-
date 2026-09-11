export type Chain = 'Ethereum' | 'Solana' | 'BNB Chain' | 'Base' | 'Arbitrum' | 'Avalanche';

export interface TokenHolder {
  address: string;
  percentage: number;
  balance: string;
  tag?: 'Creator' | 'Exchange' | 'Whale' | 'Smart Money';
}

export interface SecurityAudit {
  honeypotChecked: boolean;
  isHoneypot: boolean;
  mintStatus: 'Disabled' | 'Enabled' | 'Hidden';
  freezeStatus: 'Disabled' | 'Enabled' | 'Hidden';
  ownershipRenounced: boolean;
  lpLocked: boolean;
  lpLockPercent: number;
  lpUnlockDate?: string;
  burnPercent: number;
  buyTax: number; // e.g. 5 for 5%
  sellTax: number;
  transferRestrictions: boolean;
  suspiciousFunctions: string[];
}

export interface Token {
  address: string;
  pairAddress: string;
  name: string;
  symbol: string;
  chain: Chain;
  price: number;
  priceNative?: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  mcap: number;
  fdv: number;
  circulatingSupply: number;
  holderCount: number;
  topHolders: TokenHolder[];
  creatorWallet: string;
  tokenAgeDays: number;
  dexName: string;
  verified: boolean;
  promoted: boolean;
  logo?: string;
  banner?: string;
  header?: string;
  securityScore: number; // 0 - 100
  rugRiskScore: 'Low' | 'Medium' | 'High' | 'Critical';
  lastUpdated?: number;
  poolBaseAmount?: number;
  poolQuoteAmount?: number;
  quoteSymbol?: string;
  txns24hBuys?: number;
  txns24hSells?: number;
  uniqueBuyers24h?: number;
  uniqueSellers24h?: number;
  priceChange5m?: number;
  priceChange6h?: number;
  txns5m?: { buys: number; sells: number };
  txns1h?: { buys: number; sells: number };
  txns6h?: { buys: number; sells: number };
  txns24h?: { buys: number; sells: number };
  volume5m?: number;
  volume1h?: number;
  volume6h?: number;
  buyers5m?: number;
  sellers5m?: number;
  buyers1h?: number;
  sellers1h?: number;
  buyers6h?: number;
  sellers6h?: number;
  buyers24h?: number;
  sellers24h?: number;
  pairCreatedAt?: number;
  quoteAddress?: string;
  socials: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    whitepaper?: string;
    explorer?: string;
  };
}

export interface Transaction {
  id: string;
  hash: string;
  timestamp: string; // ISO string
  type: 'buy' | 'sell' | 'swap' | 'add_liquidity' | 'remove_liquidity';
  amountUSD: number;
  amountToken: number;
  priceUSD: number;
  maker: string;
  makerTag?: 'Whale' | 'Smart Money' | 'Sniper' | 'Bot' | 'Retail';
  tokenSymbol: string;
  tokenName?: string;
  tokenLogo?: string;
  tokenAddress: string;
  chain: Chain;
  dexName?: string;
  marketCap?: number;
  liquidity?: number;
  pairAddress?: string;
}

export interface DexStreamTransaction extends Transaction {
  tokenName: string;
  tokenLogo: string;
  dexName: string;
  type: 'buy' | 'sell' | 'swap';
  marketCap: number;
  liquidity: number;
}

export interface Candle {
  time: number; // timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type WalletClassification = 'Whale' | 'Smart Money' | 'High Activity' | 'New Wallet' | 'Exchange Wallet' | 'Team Wallet';

export type SmartTransactionType = 'buy' | 'sell' | 'transfer' | 'accumulation' | 'distribution';

export interface SmartWhaleTransaction {
  id: string;
  signature: string;
  timestamp: string; // ISO string
  blockTime?: number; // Unix seconds
  walletAddress: string;
  walletLabel?: string;
  walletClassification: WalletClassification;
  type: SmartTransactionType;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenLogo?: string;
  amount: number;
  amountUSD: number;
  chain: 'Solana';
  fromAddress?: string;
  toAddress?: string;
}

export interface SmartWhaleProfile {
  address: string;
  label: string;
  classification: WalletClassification;
  portfolioValueUSD: number;
  solBalance: number;
  winRate: number; // percentage
  netProfitUSD: number;
  totalTrades24h: number;
  walletAgeDays: number;
  mostTradedTokens: {
    symbol: string;
    name: string;
    address: string;
    logo?: string;
    volumeUSD: number;
    tradesCount: number;
  }[];
  holdings: {
    symbol: string;
    name: string;
    address: string;
    logo?: string;
    balance: number;
    valueUSD: number;
    priceUSD: number;
  }[];
  recentTransactions: SmartWhaleTransaction[];
}

export interface WhaleTrackerFilters {
  tokenSymbolOrAddress?: string;
  minAmountUSD: number;
  transactionType: 'all' | SmartTransactionType;
  classification: 'all' | WalletClassification;
  timeframe: '1h' | '24h' | '7d';
}

export interface WhaleWallet {
  address: string;
  tag: WalletClassification | 'Sniper' | 'Bot' | 'Developer';
  balanceUSD: number;
  pnlUSD: number;
  winRate: number; // e.g. 74%
  tradesCount24h: number;
  recentTrades: {
    timestamp: string;
    tokenSymbol: string;
    tokenAddress: string;
    chain: Chain;
    type: 'buy' | 'sell' | 'transfer' | 'accumulation' | 'distribution';
    amountUSD: number;
    pnl?: number;
  }[];
}

export interface PriceAlert {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  type: 'price' | 'volume' | 'liquidity';
  condition: 'above' | 'below';
  value: number;
  channel: 'email' | 'telegram' | 'browser';
  triggered: boolean;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  summary: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  timestamp: string;
  url: string;
}

export interface LaunchItem {
  id: string;
  tokenName: string;
  symbol: string;
  chain: Chain;
  launchDate: string;
  raisedUSD?: number;
  status: 'Upcoming' | 'Active' | 'Completed';
  website?: string;
  socials?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    medium?: string;
    github?: string;
  };
}

export interface ChainStats {
  chain: Chain;
  volume24h: number;
  txsCount24h: number;
  activeWallets: number;
  avgGasPriceGwei: number;
  tvl: number;
}

export interface AdCampaign {
  id: string;
  title: string;
  sponsor: string;
  imageUrl: string;
  targetUrl: string;
  active: boolean;
  clicks: number;
}
