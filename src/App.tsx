import React, { useState, useRef, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  Users, 
  Wallet, 
  Newspaper, 
  Settings, 
  Menu, 
  X, 
  Sparkles, 
  Zap, 
  ShieldAlert, 
  DollarSign,
  ShieldCheck,
  Sun,
  Moon,
  Palette,
  BookOpen,
  Terminal,
  Compass,
  GraduationCap,
  ExternalLink,
  Twitter,
  Send,
  MessageSquare,
  Github,
  BookOpenText,
  Coins,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardView from './components/DashboardView';
import ScreenerView from './components/ScreenerView';
import PairDetailsView from './components/PairDetailsView';
import WhalesView from './components/WhalesView';
import PortfolioView from './components/PortfolioView';
import NewsView from './components/NewsView';
import AdminView from './components/AdminView';
import SurchiLogo from './components/SurchiLogo';
import AuditorView from './components/AuditorView';
import AppFooter from './components/AppFooter';
import TokenCreatorView from './components/TokenCreatorView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import WalletModal from './components/WalletModal';
import { screenerStore } from './utils/screenerStore';
import SplashScreen from './components/SplashScreen';
import { useSolanaWallet } from './context/SolanaWalletContext';
import { Token } from './types';

type ActiveView = 'dashboard' | 'screener' | 'details' | 'whales' | 'portfolio' | 'news' | 'admin' | 'auditor' | 'token-creator' | 'privacy-policy';

export default function App() {
  const { connectedWallet } = useSolanaWallet();
  const [showSplash, setShowSplash] = useState(true);

  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (
        search.includes('solflare_encryption_public_key') ||
        search.includes('phantom_encryption_public_key') ||
        search.includes('wallet_encryption_public_key') ||
        search.includes('surchi_wallet_callback')
      ) {
        return 'token-creator';
      }
    }
    return 'dashboard';
  });
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<'cyan' | 'gold' | 'green' | 'ruby'>(() => {
    return (localStorage.getItem('surchi-theme') as 'cyan' | 'gold' | 'green' | 'ruby') || 'cyan';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('surchi-dark-mode');
    return saved !== null ? saved === 'true' : true;
  });

  const [showThemePanel, setShowThemePanel] = useState(false);

  useEffect(() => {
    localStorage.setItem('surchi-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('surchi-dark-mode', String(isDarkMode));
  }, [isDarkMode]);

  // Search state passed between panels
  const [searchQuery, setSearchQuery] = useState('');
  
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0 });
  }, [activeView, selectedTokenAddress]);
  
  // Premium level (Always unlocked)
  const isPro = true;
  
  // Mobile menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGoHome = () => {
    setActiveView('dashboard');
    setSelectedTokenAddress(null);
    setMobileMenuOpen(false);
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToToken = (address: string) => {
    if (activeView === 'screener' && mainRef.current) {
      screenerStore.setScrollTop(mainRef.current.scrollTop);
    }
    setSelectedTokenAddress(address);
    setActiveView('details');
  };

  const handleGlobalSearch = (query: string) => {
    // If it looks like a contract address, navigate directly
    const trimmed = query.trim();
    const isEvm = /^0x[a-fA-F0-9]{40}$/i.test(trimmed);
    const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
    if (isEvm || isSol) {
      navigateToToken(trimmed);
    } else {
      setSearchQuery(query);
      setActiveView('screener');
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className={`theme-${theme} ${isDarkMode ? 'mode-dark text-slate-100' : 'mode-light text-slate-900'} bg-elegant-bg min-h-screen text-elegant-text-primary flex flex-col font-sans select-none antialiased`}>


      {/* Main Container Wrapper */}
      <div className="flex flex-1 relative">
        
        {/* Desktop Left Sidebar Panel */}
        <aside className="hidden lg:flex flex-col w-64 bg-elegant-surface border-r border-elegant-border p-5 space-y-6 shrink-0 justify-between">
          <div className="space-y-6">
            
            {/* Branding Header */}
            <button
              type="button"
              onClick={handleGoHome}
              className="flex items-center space-x-2 pb-4 border-b border-elegant-border w-full text-left group cursor-pointer transition-opacity hover:opacity-90"
              title="Go to Home Dashboard"
              aria-label="SURCHI Home"
            >
              <SurchiLogo size={32} className="group-hover:scale-105 transition-transform duration-200" />
              <div>
                <h2 className="text-white font-extrabold text-sm tracking-tight font-sans group-hover:text-elegant-gold transition-colors">SURCHI</h2>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="text-[9px] text-elegant-text-secondary font-mono">DEX LEDGER ENGINE</span>
                  {isPro && (
                    <span className="text-[8px] bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/30 px-1 rounded font-bold">
                      PRO
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Menu options */}
            <nav className="space-y-1">
              <span className="text-gray-600 text-[10px] font-mono font-bold uppercase block px-3 mb-2 tracking-wider">WORKSPACE</span>
              <button
                onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'dashboard' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span>Home Dashboard</span>
              </button>

              <button
                onClick={() => { setActiveView('screener'); setSearchQuery(''); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'screener' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Token Screener</span>
              </button>
              <button
                onClick={() => { setActiveView('auditor'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'auditor' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Contract Auditor</span>
              </button>
              <button
                onClick={() => { setActiveView('whales'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'whales' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Smart Money Tracker</span>
              </button>
              <button
                onClick={() => { setActiveView('portfolio'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'portfolio' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <Wallet className="w-4 h-4 shrink-0" />
                <span>Portfolio Hub</span>
              </button>

              <button
                onClick={() => { setActiveView('token-creator'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'token-creator' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <Coins className="w-4 h-4 shrink-0" />
                <span>Create Solana Token</span>
              </button>
              
              <span className="text-gray-600 text-[10px] font-mono font-bold uppercase block px-3 pt-5 mb-2 tracking-wider">MARKET CALENDARS</span>
              <button
                onClick={() => { setActiveView('news'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide cursor-pointer ${
                  activeView === 'news' ? 'bg-elegant-gold text-elegant-bg shadow-[0_0_10px_rgba(197,168,128,0.15)] font-bold' : 'text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover'
                }`}
              >
                <Newspaper className="w-4 h-4 shrink-0" />
                <span>Sentiment & Calendar</span>
              </button>

              <span className="text-gray-600 text-[10px] font-mono font-bold uppercase block px-3 pt-5 mb-2 tracking-wider">DOCS & RESOURCES</span>
              <a
                href="https://solscan.io/token/C8QShhzBJEA769SYTKRfg2fFFNP3dxqaKumApMi4huhi"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover group"
              >
                <div className="flex items-center space-x-3">
                  <Compass className="w-4 h-4 shrink-0 text-elegant-gold" />
                  <span>Explorer</span>
                </div>
              </a>
              <a
                href="https://academy.binance.com/en/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover group"
              >
                <div className="flex items-center space-x-3">
                  <GraduationCap className="w-4 h-4 shrink-0 text-elegant-gold" />
                  <span>Academy</span>
                </div>
              </a>
              <a
                href="https://whitepaper.surchi.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover group"
              >
                <div className="flex items-center space-x-3">
                  <BookOpen className="w-4 h-4 shrink-0 text-elegant-gold" />
                  <span>White Paper</span>
                </div>
              </a>
              <a
                href="https://explorer.surchi.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide text-elegant-text-secondary hover:text-white hover:bg-elegant-surface-hover group"
              >
                <div className="flex items-center space-x-3">
                  <Terminal className="w-4 h-4 shrink-0 text-elegant-gold" />
                  <span>Surchi Terminal</span>
                </div>
              </a>


            </nav>
          </div>

          {/* Surchi Active status info */}
          <div className="bg-elegant-surface border border-elegant-border p-4 rounded-xl text-xs space-y-2 mb-2">
            <div className="flex items-center space-x-1 text-elegant-gold font-bold font-mono uppercase text-[10px] gold-glow">
              <Sparkles className="w-3.5 h-3.5" /> SURCHI AI Engine
            </div>
            <p className="text-elegant-text-secondary leading-relaxed font-sans text-[11px]">
              Fully unlocked access enabled. All advanced contract audits, portfolio analytics, and premium layers are available.
            </p>
          </div>
          
          {/* Privacy Policy Link */}
          <div className="text-center pb-2">
            <button
              onClick={() => setActiveView('privacy-policy')}
              className="text-[10px] text-elegant-text-secondary hover:text-white transition-colors uppercase tracking-wider font-semibold cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Header */}
        <header className="lg:hidden absolute top-0 left-0 w-full h-16 bg-elegant-surface border-b border-elegant-border px-4 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={handleGoHome}
            className="flex items-center space-x-2 cursor-pointer group text-left hover:opacity-90 transition-opacity"
            title="Go to Home Dashboard"
            aria-label="SURCHI Home"
          >
            <SurchiLogo size={28} className="group-hover:scale-105 transition-transform duration-200" />
            <span className="text-white font-bold text-sm tracking-tight group-hover:text-elegant-gold transition-colors">SURCHI</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-white hover:text-elegant-gold transition-colors cursor-pointer rounded-lg hover:bg-white/5"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
        </header>

        {/* Mobile Left-Side White Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              {/* Backdrop covering right side of screen */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
                aria-label="Close backdrop"
              />

              {/* Dark Theme Drawer */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="relative z-10 w-[84vw] max-w-[340px] bg-elegant-surface border-r border-elegant-border text-elegant-text h-full shadow-2xl flex flex-col justify-between overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="px-4 py-3.5 border-b border-elegant-border flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="flex items-center space-x-2.5 cursor-pointer group text-left hover:opacity-90 transition-opacity"
                    title="Go to Home Dashboard"
                    aria-label="SURCHI Home"
                  >
                    <SurchiLogo size={28} className="group-hover:scale-105 transition-transform duration-200" />
                    <span className="text-white font-bold text-base tracking-tight font-sans group-hover:text-elegant-gold transition-colors">SURCHI</span>
                  </button>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-elegant-text-secondary hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    aria-label="Close navigation"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Content Body */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                  {/* Primary Navigation Section */}
                  <div className="space-y-1">
                    <button
                      onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'dashboard'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <Zap className={`w-4 h-4 shrink-0 ${activeView === 'dashboard' ? 'text-elegant-gold' : 'text-elegant-text-secondary'}`} />
                      <span>Home Dashboard</span>
                    </button>

                    <button
                      onClick={() => { setActiveView('screener'); setSearchQuery(''); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'screener'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <BarChart3 className={`w-4 h-4 shrink-0 ${activeView === 'screener' ? 'text-elegant-gold' : 'text-elegant-text-secondary'}`} />
                      <span>Screener</span>
                    </button>

                    <button
                      onClick={() => { setActiveView('auditor'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'auditor'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className={`w-4 h-4 shrink-0 ${activeView === 'auditor' ? 'text-elegant-gold' : 'text-elegant-text-secondary'}`} />
                      <span>Contract Auditor</span>
                    </button>

                    <button
                      onClick={() => { setActiveView('whales'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'whales'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <Users className={`w-4 h-4 shrink-0 ${activeView === 'whales' ? 'text-elegant-gold' : 'text-elegant-text-secondary'}`} />
                      <span>Whales</span>
                    </button>

                    <button
                      onClick={() => { setActiveView('portfolio'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'portfolio'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <Wallet className={`w-4 h-4 shrink-0 ${activeView === 'portfolio' ? 'text-elegant-gold' : 'text-elegant-text-secondary'}`} />
                      <span>Portfolio</span>
                    </button>

                    <button
                      onClick={() => { setActiveView('news'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'news'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <Newspaper className={`w-4 h-4 shrink-0 ${activeView === 'news' ? 'text-elegant-gold' : 'text-elegant-text-secondary'}`} />
                      <span>Sentiment News</span>
                    </button>

                    <button
                      onClick={() => { setActiveView('token-creator'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
                        activeView === 'token-creator'
                          ? 'bg-elegant-surface-hover text-white font-semibold shadow-sm'
                          : 'text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white'
                      }`}
                    >
                      <span className="text-base shrink-0">🪙</span>
                      <span>Create Solana Token</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="py-2">
                    <hr className="border-elegant-border" />
                  </div>

                  {/* Secondary Navigation Section */}
                  <div className="space-y-1">
                    <a
                      href="https://solscan.io/token/C8QShhzBJEA769SYTKRfg2fFFNP3dxqaKumApMi4huhi"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3.5">
                        <Compass className="w-4 h-4 text-elegant-gold shrink-0" />
                        <span>Explorer</span>
                      </div>
                    </a>

                    <a
                      href="https://academy.binance.com/en/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3.5">
                        <GraduationCap className="w-4 h-4 text-elegant-gold shrink-0" />
                        <span>Academy</span>
                      </div>
                    </a>
                    <a
                      href="https://whitepaper.surchi.xyz/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3.5">
                        <BookOpen className="w-4 h-4 text-elegant-gold shrink-0" />
                        <span>White Paper</span>
                      </div>
                    </a>

                    <a
                      href="https://explorer.surchi.xyz/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3.5">
                        <Terminal className="w-4 h-4 text-elegant-gold shrink-0" />
                        <span>Surchi Terminal</span>
                      </div>
                    </a>
                  </div>

                  {/* Divider */}
                  <div className="py-2">
                    <hr className="border-elegant-border" />
                  </div>

                  {/* Bottom Resources & Community Section (Reference layout) */}
                  <div className="space-y-1">
                    <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold text-elegant-text-secondary uppercase tracking-wider">
                      Resources & Community
                    </div>
                    
                    <a
                      href="https://GitHub.com/surchiai"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Github className="w-4 h-4 text-elegant-text-secondary shrink-0" />
                        <span>GitHub</span>
                      </div>
                    </a>

                    <a
                      href="https://x.com/suchicoin"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Twitter className="w-4 h-4 text-elegant-text-secondary shrink-0" />
                        <span>Twitter</span>
                      </div>
                    </a>

                    <a
                      href="https://t.me/Surchicommunity"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Send className="w-4 h-4 text-elegant-text-secondary shrink-0" />
                        <span>Telegram</span>
                      </div>
                    </a>

                    <a
                      href="https://medium.com/@surchicoin"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <BookOpenText className="w-4 h-4 text-elegant-text-secondary shrink-0" />
                        <span>Medium</span>
                      </div>
                    </a>

                    <a
                      href="https://discord.gg/uH2Jp3yu5h"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="w-4 h-4 text-elegant-text-secondary shrink-0" />
                        <span>Discord</span>
                      </div>
                    </a>

                    <a
                      href="mailto:support@surchi.xyz"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-elegant-text-secondary hover:bg-elegant-surface-hover/50 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Mail className="w-4 h-4 text-elegant-text-secondary shrink-0" />
                        <span>Contact Us</span>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Drawer Subtle Footer */}
                <div className="px-4 py-3 bg-elegant-bg border-t border-elegant-border flex flex-col items-center justify-center text-[11px] text-elegant-text-secondary shrink-0 font-mono space-y-2">
                  <span>POWERED BY SURCHI ECOSYSTEM</span>
                  <button
                    onClick={() => { setActiveView('privacy-policy'); setMobileMenuOpen(false); }}
                    className="text-[10px] hover:text-white transition-colors uppercase tracking-wider font-semibold cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Workspace core panels routing */}
        <main ref={mainRef} className="flex-1 bg-elegant-bg p-4 sm:p-6 lg:p-8 overflow-y-auto mt-16 lg:mt-0 max-w-7xl mx-auto w-full">
          {activeView === 'dashboard' && (
            <DashboardView 
              onSelectToken={navigateToToken} 
              onSearch={handleGlobalSearch} 
            />
          )}

          {/* Persistent Screener View: kept mounted to preserve exact token list, live prices, scroll position, and pagination */}
          <div 
            style={{ display: activeView === 'screener' ? 'block' : 'none' }}
            aria-hidden={activeView !== 'screener'}
            className={activeView === 'screener' ? 'block' : 'hidden'}
          >
            <ScreenerView 
              onSelectToken={navigateToToken} 
              initialQuery={searchQuery} 
              onClose={() => setActiveView('dashboard')}
              scrollContainerRef={mainRef}
              isActive={activeView === 'screener'}
            />
          </div>

          {activeView === 'details' && selectedTokenAddress && (
            <PairDetailsView 
              tokenAddress={selectedTokenAddress} 
              onBack={() => { 
                setSelectedTokenAddress(null); 
                setActiveView('screener'); 
                requestAnimationFrame(() => {
                  if (mainRef.current) {
                    mainRef.current.scrollTop = screenerStore.getScrollTop();
                  }
                });
              }}
            />
          )}

          {activeView === 'whales' && (
            <WhalesView 
              onSelectToken={navigateToToken} 
            />
          )}

          {activeView === 'portfolio' && (
            <PortfolioView />
          )}

          {activeView === 'news' && (
            <NewsView />
          )}

          {activeView === 'admin' && (
            <AdminView />
          )}

          {activeView === 'auditor' && (
            <AuditorView 
              onBackToEcosystem={() => { setActiveView('dashboard'); }}
              onSelectToken={navigateToToken}
            />
          )}

          {activeView === 'token-creator' && (
            <TokenCreatorView onClose={() => setActiveView('dashboard')} />
          )}

          {activeView === 'privacy-policy' && (
            <PrivacyPolicyView onClose={() => setActiveView('dashboard')} />
          )}

          {/* Surchi Ecosystem Footer */}
          <AppFooter 
            currentView={activeView}
            onNavigate={(view) => {
              setActiveView(view);
              const scrollContainer = mainRef.current || window;
              scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }} 
          />
        </main>

      </div>

      {/* Floating Theme Switcher Button (Direct Light / Dark Mode Toggle) */}
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsDarkMode(prev => !prev)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold text-white hover:scale-105 active:scale-95 shadow-xl shadow-black/50 transition-all cursor-pointer"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          id="floating-theme-switch-btn"
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-400 hover:-rotate-12 transition-transform" />
          )}
        </button>
      </div>

      {/* Global Solana Wallet Modal */}
      <WalletModal
        onConnected={() => {
          setActiveView('token-creator');
          if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
    </>
  );
}
