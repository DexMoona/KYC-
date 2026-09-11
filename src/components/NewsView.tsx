import React, { useState, useEffect } from 'react';
import { Newspaper, CalendarDays, RefreshCw, Flame, ExternalLink, Globe, Twitter, Send, MessageSquare, BookOpenText, Github } from 'lucide-react';
import { NewsItem, LaunchItem } from '../types';
import TokenIcon from './TokenIcon';

export default function NewsView() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [launches, setLaunches] = useState<LaunchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const data = await res.json();
        setNews(data.news || []);
        setLaunches(data.launches || []);
      } else {
        throw new Error('Non-ok response from news API');
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      // Ensure fallbacks are set so the user has some relevant news/launches
      setNews([
        {
          id: 'n1',
          title: 'Solana DEX Volume Flirts With Ethereum Post Meme Surge',
          source: 'Coindesk',
          summary: 'Decentralized exchange activity on Solana surged past key benchmarks, driven by massive liquidity pooling in newly created meme tokens.',
          sentiment: 'Bullish',
          timestamp: new Date().toISOString(),
          url: 'https://coindesk.com'
        },
        {
          id: 'n2',
          title: 'SEC Moves To Classify Specific Smart Contract Yield Protocols',
          source: 'CryptoSlate',
          summary: 'The regulatory focus shifts towards decentralized liquidity-providing mechanisms, triggering cautious trading behaviors from institutional LP accounts.',
          sentiment: 'Bearish',
          timestamp: new Date().toISOString(),
          url: 'https://cryptoslate.com'
        }
      ]);
      setLaunches([
        {
          id: 'l1',
          tokenName: 'AeroVolt Finance',
          symbol: 'AVOLT',
          chain: 'Base',
          launchDate: new Date(Date.now() + 86400000 * 1.5).toISOString(),
          raisedUSD: 350000,
          status: 'Upcoming',
          website: 'https://aerovolt.finance',
          socials: {
            twitter: 'https://x.com/aerovolt_fi',
            telegram: 'https://t.me/aerovolt_official',
            discord: 'https://discord.gg/aerovolt'
          }
        },
        {
          id: 'l2',
          tokenName: 'NovaDex Aggregator',
          symbol: 'NDX',
          chain: 'Arbitrum',
          launchDate: new Date(Date.now() + 86400000 * 3.1).toISOString(),
          raisedUSD: 780000,
          status: 'Upcoming',
          website: 'https://novadex.io',
          socials: {
            twitter: 'https://x.com/novadex_agg',
            telegram: 'https://t.me/novadex_portal',
            medium: 'https://medium.com/@novadex'
          }
        },
        {
          id: 'l3',
          tokenName: 'SolSpheres',
          symbol: 'SPHERE',
          chain: 'Solana',
          launchDate: new Date(Date.now() - 12000000).toISOString(),
          raisedUSD: 1200000,
          status: 'Active',
          website: 'https://solspheres.io',
          socials: {
            twitter: 'https://x.com/solspheres',
            telegram: 'https://t.me/solspheres',
            discord: 'https://discord.gg/solspheres',
            github: 'https://github.com/solspheres-protocol'
          }
        },
        {
          id: 'l4',
          tokenName: 'EtherShield Layer3',
          symbol: 'ES3',
          chain: 'Ethereum',
          launchDate: new Date(Date.now() + 86400000 * 6.5).toISOString(),
          raisedUSD: 2400000,
          status: 'Upcoming',
          website: 'https://ethershield.network',
          socials: {
            twitter: 'https://x.com/ethershield_l3',
            telegram: 'https://t.me/ethershield_sec',
            discord: 'https://discord.gg/ethershield'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-elegant-surface border border-elegant-border rounded-xl p-6 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 w-1/4 h-full opacity-10 pointer-events-none bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-elegant-gold via-transparent to-transparent"></div>
        <div className="max-w-xl space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-elegant-gold" /> Sentiment News Feed & Launch Pad
          </h2>
          <p className="text-elegant-text-secondary text-xs font-sans leading-relaxed">
            Real-time feed aggregating headlines, pre-sale launch schedules, and index governance votes across Decentralized Finance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* News Feed column */}
        <div className="lg:col-span-2 bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
          <div className="pb-2 border-b border-elegant-border">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-elegant-gold" /> Decoded Headlines
            </h3>
          </div>

          <div className="space-y-4">
            {news.map(ns => (
              <div key={ns.id} className="bg-elegant-bg/40 hover:bg-elegant-surface-hover/60 border border-elegant-border p-4 rounded-xl flex flex-col space-y-2 transition-all">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-elegant-text-secondary font-mono uppercase">{ns.source} • {new Date(ns.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                    ns.sentiment === 'Bullish' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-red-950/40 text-red-400 border-red-900/40'
                  }`}>
                    {ns.sentiment}
                  </span>
                </div>
                <h4 className="text-white font-bold text-sm leading-snug">{ns.title}</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{ns.summary}</p>
                <div className="pt-1 flex">
                  <a href={ns.url} target="_blank" rel="noreferrer" className="text-elegant-gold hover:text-elegant-gold-hover text-xs font-mono font-semibold inline-flex items-center gap-1">
                    Read coverage <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Launchpad upcoming columns */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4">
          <div className="pb-2 border-b border-elegant-border">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-elegant-gold" /> Upcoming Launch Calendar
            </h3>
          </div>

          <div className="space-y-3.5">
            {launches.map(lc => {
              const hasSocials = lc.socials && Object.values(lc.socials).some(Boolean);
              return (
                <div key={lc.id} className="bg-elegant-bg/40 border border-elegant-border rounded-lg p-3 space-y-2.5 hover:border-elegant-border/80 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <TokenIcon symbol={lc.symbol} chain={lc.chain} size="xs" />
                      <span className="text-white font-bold text-xs font-mono">{lc.symbol}</span>
                      <span className="text-[9px] text-elegant-text-secondary font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{lc.chain}</span>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold font-mono ${
                      lc.status === 'Active' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-elegant-bg text-elegant-text-secondary border border-elegant-border'
                    }`}>
                      {lc.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-gray-200 text-xs font-bold">{lc.tokenName}</h4>
                    <p className="text-elegant-text-secondary text-[10px] font-mono mt-0.5">LAUNCH: {new Date(lc.launchDate).toLocaleDateString()}</p>
                  </div>

                  {lc.raisedUSD && (
                    <div className="flex justify-between items-center text-[10px] font-mono pt-1.5 border-t border-elegant-border/40 text-elegant-text-secondary">
                      <span>CAP GOAL:</span>
                      <span className="text-white font-bold">${lc.raisedUSD.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Project Website Link & Socials */}
                  {(lc.website || hasSocials) && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-elegant-border/40">
                      {lc.website ? (
                        <a
                          href={lc.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-[10px] font-mono text-elegant-gold hover:text-white transition-colors group"
                          title={`${lc.tokenName} Website`}
                        >
                          <Globe className="w-3 h-3 text-elegant-gold group-hover:scale-110 transition-transform" />
                          <span>Website</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      ) : (
                        <div />
                      )}

                      {hasSocials && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          {lc.socials?.twitter && (
                            <a
                              href={lc.socials.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-slate-400 hover:text-sky-400 transition-colors"
                              title="Twitter / X"
                              aria-label={`${lc.tokenName} Twitter`}
                            >
                              <Twitter className="w-3 h-3" />
                            </a>
                          )}
                          {lc.socials?.telegram && (
                            <a
                              href={lc.socials.telegram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-slate-400 hover:text-blue-400 transition-colors"
                              title="Telegram"
                              aria-label={`${lc.tokenName} Telegram`}
                            >
                              <Send className="w-3 h-3" />
                            </a>
                          )}
                          {lc.socials?.discord && (
                            <a
                              href={lc.socials.discord}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-slate-400 hover:text-indigo-400 transition-colors"
                              title="Discord"
                              aria-label={`${lc.tokenName} Discord`}
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          )}
                          {lc.socials?.medium && (
                            <a
                              href={lc.socials.medium}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-slate-400 hover:text-white transition-colors"
                              title="Medium"
                              aria-label={`${lc.tokenName} Medium`}
                            >
                              <BookOpenText className="w-3 h-3" />
                            </a>
                          )}
                          {lc.socials?.github && (
                            <a
                              href={lc.socials.github}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-slate-400 hover:text-white transition-colors"
                              title="GitHub"
                              aria-label={`${lc.tokenName} GitHub`}
                            >
                              <Github className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
