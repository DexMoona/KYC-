import React from 'react';

interface ChainIconProps {
  chain: string;
  className?: string;
}

export default function ChainIcon({ chain, className = "w-4 h-4" }: ChainIconProps) {
  const norm = chain ? chain.toLowerCase().trim() : '';

  if (norm === 'all' || norm === 'all chains') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="All Chains">
        <circle cx="12" cy="12" r="9" className="text-elegant-gold" />
        <path d="M3.6 9h16.8M3.6 15h16.8" className="text-white/80" />
        <path d="M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18" className="text-white/80" />
      </svg>
    );
  }

  if (norm.includes('ethereum') || norm === 'eth') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Ethereum">
        <path fill="#627EEA" d="M12 2L4.5 14.25L12 18.75L19.5 14.25L12 2Z" />
        <path fill="#8A92B2" d="M12 2L4.5 14.25L12 10.5V2Z" />
        <path fill="#627EEA" d="M12 19.88L4.5 15.38L12 22L19.5 15.38L12 19.88Z" />
        <path fill="#8A92B2" d="M12 19.88L4.5 15.38L12 22V19.88Z" />
        <path fill="#454A75" d="M12 10.5L19.5 14.25L12 18.75V10.5Z" />
        <path fill="#2B2E4A" d="M4.5 14.25L12 10.5V18.75L4.5 14.25Z" />
      </svg>
    );
  }

  if (norm.includes('solana') || norm === 'sol') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Solana">
        <defs>
          <linearGradient id="solana-chain-grad-icon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FFA3" />
            <stop offset="100%" stopColor="#DC1FFF" />
          </linearGradient>
        </defs>
        <path fill="url(#solana-chain-grad-icon)" d="M4.5 18a.6.6 0 0 1 .4-.2h15a.4.4 0 0 1 .3.7l-3.2 3.2a.6.6 0 0 1-.4.2h-15a.4.4 0 0 1-.3-.7l3.2-3.2zm0-14a.6.6 0 0 1 .4-.2h15a.4.4 0 0 1 .3.7l-3.2 3.2a.6.6 0 0 1-.4.2h-15a.4.4 0 0 1-.3-.7L4.5 4zm15 7a.6.6 0 0 1-.4.2h-15a.4.4 0 0 1-.3-.7l3.2-3.2a.6.6 0 0 1 .4-.2h15a.4.4 0 0 1 .3.7l-3.2 3.2z" />
      </svg>
    );
  }

  if (norm.includes('bnb') || norm.includes('bsc') || norm.includes('binance')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="BNB Chain">
        <path fill="#F3BA2F" d="M12 2l3.6 3.6L12 9.2 8.4 5.6 12 2zm0 14.4l3.6 3.6L12 23.6l-3.6-3.6 3.6-3.6zm7.2-7.2l3.6 3.6-3.6 3.6-3.6-3.6 3.6-3.6zM4.8 9.2l3.6 3.6-3.6 3.6L1.2 12.8l3.6-3.6zm7.2 2.4l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4z" />
      </svg>
    );
  }

  if (norm.includes('base')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Base">
        <circle cx="12" cy="12" r="10" fill="#0052FF" />
        <path fill="#FFFFFF" d="M12 6.5C8.96 6.5 6.5 8.96 6.5 12s2.46 5.5 5.5 5.5c2.83 0 5.16-2.14 5.45-4.9H9.4v-1.2h8.05C17.16 8.64 14.83 6.5 12 6.5z" />
      </svg>
    );
  }

  if (norm.includes('arbitrum') || norm === 'arb') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Arbitrum">
        <rect width="24" height="24" rx="5" fill="#28A0F0" />
        <path fill="#FFFFFF" d="M12 3.5L5 7.5v9l7 4 7-4v-9l-7-4zm4.8 11.8l-1.8 1V11l2.8-1.6v5.9zm-4.8 2.7l-4.8-2.7V9.7l4.8 2.8v5.8zm0-7.3L7.2 8 12 5.2 16.8 8 12 10.7z" />
        <path fill="#96BEDC" d="M12 10.7L7.2 8v2.8l4.8 2.7V10.7z" />
      </svg>
    );
  }

  if (norm.includes('avalanche') || norm === 'avax') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Avalanche">
        <rect width="24" height="24" rx="5" fill="#E84142" />
        <path fill="#FFFFFF" d="M17.2 17.5c.4.6 1.2.6 1.6 0l1.9-3.2c.4-.6.1-1.3-.6-1.3h-2.5c-.5 0-.9.3-1.1.7l-.3.8 1 3zm-5.6-9.7c.4-.6 1.2-.6 1.6 0l5.8 10c.4.6.1 1.3-.6 1.3H5.6c-.7 0-1-.7-.6-1.3l5.6-10zm-3.8 9.7c.4.6 1.2.6 1.6 0l.7-1.2c.3-.5 0-1.1-.6-1.1H7.1c-.6 0-.9.3-1.1.7l1.8 1.6z" />
      </svg>
    );
  }

  if (norm.includes('polygon') || norm.includes('matic')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Polygon">
        <rect width="24" height="24" rx="5" fill="#8247E5" />
        <path fill="#FFFFFF" d="M16.5 8.5l-3.8-2.2c-.4-.2-.9-.2-1.3 0L7.5 8.5c-.4.2-.7.7-.7 1.1v4.4c0 .5.3.9.7 1.1l3.8 2.2c.4.2.9.2 1.3 0l3.8-2.2c.4-.2.7-.7.7-1.1V9.6c0-.4-.3-.9-.7-1.1z" />
      </svg>
    );
  }

  if (norm.includes('optimism') || norm === 'op') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Optimism">
        <circle cx="12" cy="12" r="10" fill="#FF0420" />
        <path fill="#FFFFFF" d="M8 15V9h2.5c1.4 0 2.5 1.1 2.5 2.5S11.9 14 10.5 14H8zm5 0V9h2.5c1.4 0 2.5 1.1 2.5 2.5S16.9 14 15.5 14H13z" />
      </svg>
    );
  }

  if (norm.includes('sui')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Sui">
        <circle cx="12" cy="12" r="10" fill="#3F8CFF" />
        <path fill="#FFFFFF" d="M12 18a5 5 0 0 0 5-5c0-3.1-5-8-5-8s-5 4.9-5 8a5 5 0 0 0 5 5z" />
      </svg>
    );
  }

  // Fallback: Chain initials in styled circular badge (never shows broken image icon)
  const letters = norm ? norm.slice(0, 2).toUpperCase() : '?';
  return (
    <div
      className={`${className} rounded-full bg-elegant-surface border border-elegant-gold/40 text-elegant-gold font-mono font-bold text-[9px] flex items-center justify-center shrink-0 uppercase select-none`}
      title={chain || 'Chain'}
    >
      {letters}
    </div>
  );
}
