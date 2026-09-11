import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface DataLoaderProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  progressText?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function DataLoader({
  loading,
  error,
  onRetry,
  progressText = 'Syncing on-chain ledger state...',
  className = '',
  children
}: DataLoaderProps) {
  const [progress, setProgress] = useState(5);
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let warningTimeout: NodeJS.Timeout;

    if (loading) {
      setProgress(5);
      setShowSlowWarning(false);

      // Simulate step-by-step progress
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95; // don't hit 100% until finished
          const increment = prev < 50 ? 8 : prev < 80 ? 4 : 1;
          return prev + increment;
        });
      }, 400);

      // Show slow connection warning after 5 seconds of loading
      warningTimeout = setTimeout(() => {
        setShowSlowWarning(true);
      }, 5000);
    } else {
      setProgress(100);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(warningTimeout);
    };
  }, [loading]);

  if (error) {
    return (
      <div id="data-loader-error" className={`flex flex-col items-center justify-center p-8 text-center bg-elegant-surface border border-red-900/30 rounded-xl space-y-4 shadow-md ${className}`}>
        <div className="p-3 bg-red-950/40 text-red-400 border border-red-900/40 rounded-full animate-bounce">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h4 className="text-white font-bold text-sm">Synchronizer Interrupted</h4>
          <p className="text-red-400/95 font-mono text-[11px] bg-red-950/20 px-3 py-1.5 rounded border border-red-900/20 truncate">
            {error}
          </p>
          <p className="text-elegant-text-secondary text-xs">
            The RPC gateway or decentralized data endpoint returned an unexpected error. Please check your connection or retry.
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg text-xs font-bold rounded-lg transition-all duration-200 flex items-center space-x-1.5 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Request</span>
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
