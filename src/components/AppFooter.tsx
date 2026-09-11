import React from 'react';
import { Sparkles } from 'lucide-react';
import SurchiLogo from './SurchiLogo';

interface AppFooterProps {
  onNavigate?: (view: string) => void;
  currentView?: string;
}

export default function AppFooter({ onNavigate }: AppFooterProps) {
  return (
    <footer className="w-full bg-elegant-surface border border-elegant-border rounded-2xl text-elegant-text-primary px-6 py-5 md:py-6 mt-12 md:mt-16 shadow-sm" id="app-footer">
      {/* Footer Branding & Copyright */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate?.('dashboard')}
          className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-white/70 hover:text-white hover:bg-elegant-surface-hover/60 border border-transparent hover:border-elegant-border/60 transition-all cursor-pointer group text-left"
          title="Go to Home Dashboard"
          aria-label="SURCHI Home Dashboard"
        >
          <SurchiLogo size={20} className="group-hover:scale-110 transition-transform duration-200" />
          <Sparkles className="w-3.5 h-3.5 text-elegant-gold animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider group-hover:text-elegant-gold transition-colors">
            SURCHI DEX LEDGER ENGINE
          </span>
        </button>

        <p className="text-white/40 text-[11px] font-mono uppercase tracking-tight">
          © 2026 SURCHI AI ECOSYSTEM. ALL RIGHTS RESERVED.
        </p>
      </div>
    </footer>
  );
}



