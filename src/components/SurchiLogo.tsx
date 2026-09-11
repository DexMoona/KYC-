import React, { useState } from 'react';

interface SurchiLogoProps {
  className?: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}

// Logo.png is located inside the public folder
const PRIMARY_LOGO = '/Logo.png';

const FALLBACK_LOGO =
  'https://raw.githubusercontent.com/surchiai/surchiai.github.io/refs/heads/main/SURCHI%20logo.jpg';

export default function SurchiLogo({
  className = '',
  size = 32,
  onClick,
}: SurchiLogoProps) {
  const [imgSrc, setImgSrc] = useState(PRIMARY_LOGO);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (imgSrc === PRIMARY_LOGO) {
      setImgSrc(FALLBACK_LOGO);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div
        onClick={onClick}
        style={{
          width: size,
          height: size,
        }}
        className={`rounded-full bg-gradient-to-br from-black via-zinc-900 to-amber-950/80 border border-elegant-gold/60 text-elegant-gold font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(197,168,128,0.4)] ${onClick ? 'cursor-pointer' : ''} ${className}`}
        title="SURCHI"
      >
        S
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt="SURCHI Logo"
      width={size}
      height={size}
      onClick={onClick}
      className={`rounded-full object-cover border border-elegant-gold/40 shadow-[0_0_12px_rgba(197,168,128,0.4)] ${onClick ? 'cursor-pointer' : ''} ${className}`}
      referrerPolicy="no-referrer"
      onError={handleError}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
