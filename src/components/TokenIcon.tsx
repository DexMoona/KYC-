import React, { useState, useEffect } from 'react';

interface TokenIconProps {
  symbol: string;
  address?: string;
  chain?: string;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const KNOWN_LOGOS: Record<string, string> = {
  // Ethereum
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png',
  '0xa0b86991c6218b36c1d19d4a2e9Eb0cE3606eB48': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  
  // Solana
  'so11111111111111111111111111111111111111112': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
  'ekpnp4vjzv6m7kvykp26z8shmu5w1szwhums7a5gyump': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EKpQGSJfejNt6jgXmr1bAKJv4sbTUt5HCSFi3HG6Rb5e/logo.png',
  'dezxaz8z7pnrnmcpmzw2jhehjqk67yax667af6rwtxv8': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/DezXAZ8z7PnrnRJjz3wX4EDN9yygRuvqnrj3pHVGPGE2/logo.png',
  
  // Base
  '0x532f27101965dd16442e59d40670faf5ebb142e4': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x532f27101965dd16442e59d40670fdec56e385ff/logo.png',
  '0x4ed4e862860bed51a9570b96d89af5e1b0efefed': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x4ed4e862860bed51a9570b96d89af5e1b0efefed/logo.png',
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x940181a94a35a4569e4529a3cdfb74e38fd98631/logo.png',

  // BNB Chain
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/WBNB/logo.png',
};

const SYMBOL_FALLBACK_LOGOS: Record<string, string> = {
  'ETH': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  'WETH': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  'SOL': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
  'BTC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  'WBTC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  'USDC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  'PEPE': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png',
  'WIF': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EKpQGSJfejNt6jgXmr1bAKJv4sbTUt5HCSFi3HG6Rb5e/logo.png',
  'BONK': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/DezXAZ8z7PnrnRJjz3wX4EDN9yygRuvqnrj3pHVGPGE2/logo.png',
  'BRETT': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x532f27101965dd16442e59d40670fdec56e385ff/logo.png',
  'DEGEN': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x4ed4e862860bed51a9570b96d89af5e1b0efefed/logo.png',
  'SUI': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sui/info/logo.png',
  'SEI': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sei/info/logo.png',
};

const getChainSlug = (chain?: string): string => {
  if (!chain) return 'ethereum';
  const norm = chain.toLowerCase();
  if (norm.includes('solana')) return 'solana';
  if (norm.includes('bnb') || norm.includes('bsc') || norm.includes('binance')) return 'bsc';
  if (norm.includes('base')) return 'base';
  if (norm.includes('arbitrum')) return 'arbitrum';
  if (norm.includes('avalanche')) return 'avalanche';
  return 'ethereum';
};

const getDefaultBlockchainIcon = (chain?: string): string => {
  const norm = chain ? chain.toLowerCase() : '';
  if (norm.includes('solana') || norm.includes('sol')) {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png';
  }
  if (norm.includes('bnb') || norm.includes('bsc') || norm.includes('binance')) {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png';
  }
  if (norm.includes('base')) {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png';
  }
  if (norm.includes('arbitrum') || norm.includes('arb')) {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png';
  }
  if (norm.includes('avalanche') || norm.includes('avax')) {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanche/info/logo.png';
  }
  return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
};

export default function TokenIcon({ symbol, address, chain, logoUrl, size = 'md', className = '' }: TokenIconProps) {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    const list: string[] = [];
    const cleanAddr = address ? address.toLowerCase().trim() : '';

    // 1. Explicitly provided url
    if (logoUrl) list.push(logoUrl);

    // 2. Local cache lookups
    if (cleanAddr) {
      const cached = localStorage.getItem(`surchi_logo_${cleanAddr}`);
      if (cached && !list.includes(cached)) {
        list.push(cached);
      }
    }

    // 3. Known hardcoded map
    if (cleanAddr && KNOWN_LOGOS[cleanAddr]) {
      list.push(KNOWN_LOGOS[cleanAddr]);
    }

    // 4. DexScreener dynamic token CDN
    if (cleanAddr) {
      const slug = getChainSlug(chain);
      list.push(`https://dd.dexscreener.com/ds-data/tokens/${slug}/${cleanAddr}.png`);
    }

    // 5. Solana/Jupiter special CDNs
    if (cleanAddr && (chain === 'Solana' || !cleanAddr.startsWith('0x'))) {
      list.push(`https://img.jup.ag/v2/decals/${address}.png`);
      list.push(`https://token.jup.ag/images/${address}.png`);
    }

    // 6. Trust Wallet assets fallback paths
    if (cleanAddr && cleanAddr.startsWith('0x')) {
      const slug = getChainSlug(chain);
      if (slug === 'ethereum') {
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`);
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${cleanAddr}/logo.png`);
      } else if (slug === 'base') {
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${cleanAddr}/logo.png`);
      } else if (slug === 'bsc') {
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${address}/logo.png`);
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${cleanAddr}/logo.png`);
      } else if (slug === 'arbitrum') {
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/${cleanAddr}/logo.png`);
      } else if (slug === 'avalanche') {
        list.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanche/assets/${cleanAddr}/logo.png`);
      }
    }

    // 7. Symbol hardcoded fallback
    const upperSym = symbol.toUpperCase();
    if (SYMBOL_FALLBACK_LOGOS[upperSym]) {
      list.push(SYMBOL_FALLBACK_LOGOS[upperSym]);
    }

    // 8. Solid blockchain-specific default icons
    list.push(getDefaultBlockchainIcon(chain));

    // Deduplicate array
    const deduped = Array.from(new Set(list.filter(Boolean)));
    setCandidates(deduped);
    setCandidateIndex(0);
  }, [symbol, address, chain, logoUrl]);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[8px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-[12px]',
    lg: 'w-10 h-10 text-[14px]',
    xl: 'w-12 h-12 text-[16px]',
  };

  const currentSrc = candidates[candidateIndex];

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex(prev => prev + 1);
    }
  };

  const handleLoad = () => {
    // If successfully loaded a dynamic logo (not the fallback blockchain or symbol default),
    // save it in localStorage to make subsequent loads instant!
    if (address && currentSrc) {
      const cleanAddr = address.toLowerCase().trim();
      const defaultIcon = getDefaultBlockchainIcon(chain);
      if (currentSrc !== defaultIcon && !currentSrc.includes('info/logo.png')) {
        localStorage.setItem(`surchi_logo_${cleanAddr}`, currentSrc);
      }
    }
  };

  if (!currentSrc || candidateIndex >= candidates.length) {
    const letters = symbol.slice(0, 2).toUpperCase();
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-elegant-gold/20 via-elegant-surface/80 to-elegant-gold/5 border border-elegant-gold/30 flex items-center justify-center font-bold text-elegant-gold font-mono tracking-tighter shrink-0 select-none ${className}`}
        title={`${symbol} icon placeholder`}
      >
        {letters}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden border border-elegant-border/80 bg-elegant-bg shrink-0 flex items-center justify-center select-none ${className}`}>
      <img
        src={currentSrc}
        alt={`${symbol} icon`}
        onError={handleError}
        onLoad={handleLoad}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
