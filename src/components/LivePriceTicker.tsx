import React, { useRef } from 'react';
import { useLivePrice } from './LivePriceContext';

interface LivePriceTickerProps {
  tokenAddress: string;
  initialPrice: number;
  initialPriceChange24h?: number;
  className?: string;
  showChange?: boolean;
  changeClassName?: string;
  showFlash?: boolean;
}

export default function LivePriceTicker({
  tokenAddress,
  initialPrice,
  initialPriceChange24h = 0,
  className = '',
  showChange = false,
  changeClassName = '',
  showFlash = true
}: LivePriceTickerProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  
  const { price, priceChange24h, flash } = useLivePrice(
    tokenAddress,
    initialPrice,
    initialPriceChange24h,
    containerRef
  );

  // Format price beautifully
  const formattedPrice = price < 0.01 
    ? price.toFixed(8) 
    : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const isPositive = priceChange24h >= 0;

  return (
    <span ref={containerRef} className="inline-flex items-center gap-1.5 font-mono select-none">
      <span
        className={`transition-all duration-300 rounded-sm px-1 py-0.5 ${className} ${
          showFlash && flash === 'up'
            ? 'text-emerald-400 bg-emerald-500/15 scale-105 font-bold'
            : showFlash && flash === 'down'
              ? 'text-red-400 bg-red-500/15 scale-105 font-bold'
              : ''
        }`}
      >
        ${formattedPrice}
      </span>

      {showChange && (
        <span className={`text-[11px] font-bold transition-colors duration-200 ${changeClassName} ${
          isPositive ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {isPositive ? '▲' : '▼'} {Math.abs(priceChange24h).toFixed(2)}%
        </span>
      )}
    </span>
  );
}
