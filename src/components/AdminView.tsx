import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Layers, Sparkles, TrendingUp, Cpu, Database, Volume2 } from 'lucide-react';
import TokenIcon from './TokenIcon';

interface SystemStats {
  indexerStatus: string;
  lastIndexedBlock: number;
  blocksPerSec: number;
  redisMemoryMB: number;
  dbConnections: number;
  cpuUsagePercent: number;
  activeSubscribers: number;
  activeAdCampaigns: { id: string; title: string; sponsor: string; active: boolean; clicks: number }[];
}

export default function AdminView() {
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem('adminToken') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form for developer submission
  const [newAddress, setNewAddress] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchStats = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/system?adminToken=${encodeURIComponent(adminToken)}`);
      if (res.status === 401) {
        setAuthError('Invalid or expired administrative token');
        setAdminToken('');
        localStorage.removeItem('adminToken');
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const fetchSubmissions = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/submissions?adminToken=${encodeURIComponent(adminToken)}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchSubmissions()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadAllData();
      const interval = setInterval(() => {
        fetchStats();
        fetchSubmissions();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [adminToken]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!passwordInput.trim()) {
      setAuthError('Key cannot be empty');
      return;
    }
    // Attempt login
    setAdminToken(passwordInput.trim());
    localStorage.setItem('adminToken', passwordInput.trim());
    setPasswordInput('');
  };

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/verify?adminToken=${encodeURIComponent(adminToken)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        fetchSubmissions();
        fetchStats();
      } else {
        alert(data.error || 'Failed to approve certificate');
      }
    } catch (err) {
      console.error('Error verifying submission:', err);
    }
  };

  const handleDeveloperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(null);
    setSubmitError(null);
    if (!newAddress.trim() || !newName.trim() || !newSymbol.trim()) {
      setSubmitError('All developer submission fields are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: newAddress.trim(),
          name: newName.trim(),
          symbol: newSymbol.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitSuccess(`Token submitted successfully! Certificate is queued in the developer verification pipelines.`);
        setNewAddress('');
        setNewName('');
        setNewSymbol('');
        fetchSubmissions();
      } else {
        setSubmitError(data.error || 'Failed to submit token for verification');
      }
    } catch (err) {
      setSubmitError('Network error while submitting token');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    setAdminToken('');
    localStorage.removeItem('adminToken');
    setStats(null);
    setSubmissions([]);
  };

  // Auth Lock Screen
  if (!adminToken) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 rounded-full mb-2">
              <ShieldCheck className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-white font-bold text-lg font-sans">Administrative Credentials Required</h2>
            <p className="text-elegant-text-secondary text-xs">
              This terminal accesses secure container telemetry and live indexing logs. Please enter the diagnostic passkey (default: <code className="text-elegant-gold">admin123</code>).
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-elegant-text-secondary text-[10px] font-mono uppercase block">Diagnostic Key</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-elegant-bg border border-elegant-border rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-elegant-gold"
              />
            </div>

            {authError && (
              <p className="text-red-400 text-xs font-mono text-center">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-extrabold uppercase text-xs rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Verify Administrative Access
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-elegant-surface border border-elegant-border rounded-xl p-6 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 w-1/4 h-full opacity-10 pointer-events-none bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-elegant-gold via-transparent to-transparent"></div>
        <div className="flex justify-between items-start">
          <div className="max-w-xl space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-elegant-gold" /> Admin Diagnostic Center
            </h2>
            <p className="text-elegant-text-secondary text-xs font-sans leading-relaxed">
              Administrative diagnostic dashboard. Monitor active Cloud Run containers, Redis cluster storage logs, database queues, and verify newly compiled tokens.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 border border-red-900/60 text-red-400 hover:bg-red-950/20 rounded font-mono text-[10px] font-bold uppercase transition-all cursor-pointer"
          >
            TERMINATE SESSION
          </button>
        </div>
      </div>

      {/* Grid of system telemetry metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex items-center space-x-3.5 shadow-md">
          <div className="p-2.5 bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 rounded-lg">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">Container CPU Usage</span>
            <p className="text-white font-mono text-sm font-bold mt-0.5">{stats.cpuUsagePercent}% load</p>
          </div>
        </div>

        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex items-center space-x-3.5 shadow-md">
          <div className="p-2.5 bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">Redis Cache Node</span>
            <p className="text-white font-mono text-sm font-bold mt-0.5">{stats.redisMemoryMB} MB / 512MB</p>
          </div>
        </div>

        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex items-center space-x-3.5 shadow-md">
          <div className="p-2.5 bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">DB Pool Handles</span>
            <p className="text-white font-mono text-sm font-bold mt-0.5">{stats.dbConnections} active pools</p>
          </div>
        </div>

        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-4 flex items-center space-x-3.5 shadow-md">
          <div className="p-2.5 bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-elegant-text-secondary text-[10px] font-mono uppercase">INDEXING HEIGHT</span>
            <p className="text-white font-mono text-sm font-bold mt-0.5">#{stats.lastIndexedBlock}</p>
          </div>
        </div>

      </div>

      {/* Active verify submission pipelines vs ad manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Verification lists & Submit Token Form */}
        <div className="space-y-6">
          {/* Verification lists */}
          <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
            <div className="pb-2 border-b border-elegant-border/50">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-elegant-gold" />
                Developer Verification Pipelines
              </h3>
            </div>

            <div className="space-y-3">
              {submissions.length === 0 ? (
                <div className="text-center py-6 text-elegant-text-secondary font-mono text-xs">
                  No pending token contracts in verification queue.
                </div>
              ) : (
                submissions.map(sub => (
                  <div key={sub.id} className="bg-elegant-bg border border-elegant-border rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <TokenIcon symbol={sub.symbol} size="sm" />
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-bold text-xs">{sub.symbol}</span>
                          <span className="text-[10px] text-elegant-text-secondary font-mono truncate max-w-[120px]">{sub.address}</span>
                        </div>
                        <h4 className="text-gray-300 text-xs font-semibold">{sub.name}</h4>
                        <span className={`text-[9px] font-mono font-semibold ${sub.status === 'Verified' ? 'text-emerald-400' : 'text-elegant-gold'}`}>
                          STATUS: {sub.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {sub.status !== 'Verified' && (
                      <button
                        onClick={() => handleVerify(sub.id)}
                        className="px-3 py-1.5 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg text-[10px] font-extrabold uppercase rounded transition-all active:scale-95 cursor-pointer"
                      >
                        APPROVE CERTIFICATE
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Manual Submit Form */}
          <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
            <div className="pb-2 border-b border-elegant-border/50">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-elegant-gold" />
                Submit Contract for Verification Pipeline
              </h3>
            </div>

            <form onSubmit={handleDeveloperSubmit} className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-elegant-text-secondary block">CONTRACT ADDRESS</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-elegant-bg border border-elegant-border rounded text-white focus:outline-none focus:ring-1 focus:ring-elegant-gold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-elegant-text-secondary block">TOKEN NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. Zodiac"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-elegant-bg border border-elegant-border rounded text-white focus:outline-none focus:ring-1 focus:ring-elegant-gold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-elegant-text-secondary block">SYMBOL</label>
                  <input
                    type="text"
                    placeholder="e.g. ZODIAC"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-elegant-bg border border-elegant-border rounded text-white focus:outline-none focus:ring-1 focus:ring-elegant-gold"
                  />
                </div>
              </div>

              {submitSuccess && (
                <p className="text-emerald-400 text-[11px] font-sans">{submitSuccess}</p>
              )}
              {submitError && (
                <p className="text-red-400 text-[11px] font-sans">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-extrabold uppercase rounded cursor-pointer transition-all active:scale-95 disabled:opacity-55"
              >
                {submitting ? 'SUBMITTING CERTIFICATE...' : 'SUBMIT CERTIFICATE'}
              </button>
            </form>
          </div>
        </div>

        {/* Sponsor Advertisement Campaign Metrics */}
        <div className="bg-elegant-surface border border-elegant-border rounded-xl p-5 space-y-4 shadow-md">
          <div className="pb-2 border-b border-elegant-border/50">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-elegant-gold" />
              Sponsor Advertisement Click Metrics
            </h3>
          </div>

          <div className="space-y-3">
            {stats.activeAdCampaigns.map(camp => (
              <div key={camp.id} className="bg-elegant-bg border border-elegant-border p-4 rounded-xl flex flex-col space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white font-bold">{camp.title}</span>
                  <span className="bg-elegant-gold/10 text-elegant-gold border border-elegant-gold/20 px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">
                    ACTIVE
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono text-elegant-text-secondary border-t border-elegant-border/50 pt-2">
                  <span>Sponsor Account: <strong className="text-white">{camp.sponsor}</strong></span>
                  <span>Clicks Registered: <strong className="text-white">{camp.clicks} clicks</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
