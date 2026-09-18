import React, { useState, useEffect, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  Coins,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Image as ImageIcon,
  Globe,
  Twitter,
  Send,
  Shield,
  Info,
  RefreshCw,
  Sparkles,
  Wallet,
  ArrowRight,
  Lock,
  Unlock,
  AlertTriangle,
  X,
  Layers,
  Terminal,
  FileText
} from 'lucide-react';
import {
  TokenCreationConfig,
  TokenCreationFormData,
  CreationStep,
  CreatedTokenRecord,
  SolanaNetwork,
  WalletAdapterInfo
} from '../types/tokenCreator';
import { useSolanaWallet } from '../context/SolanaWalletContext';
import {
  getAvailableWallets,
  connectWalletProvider,
  ConnectedSolanaWallet,
  fetchWalletSolBalance,
  getSolscanTokenUrl,
  getSolscanTxUrl,
  getSolscanAddressUrl
} from '../utils/solanaWallet';
import {
  calculateRawSupply,
  executeRealSplTokenCreation
} from '../utils/tokenCreation';

const DEFAULT_FEE_WALLET = '7KiihM84H4T9gCLD61HpcRGtSapk9N2H3QAsn9A5y9Ng';
const DEFAULT_FEE_SOL = 0;

interface TokenCreatorViewProps {
  onClose?: () => void;
}

export default function TokenCreatorView({ onClose }: TokenCreatorViewProps = {}) {
  // Config & Network State
  const [config, setConfig] = useState<TokenCreationConfig>({
    feeSol: DEFAULT_FEE_SOL,
    feeWallet: DEFAULT_FEE_WALLET,
    network: 'mainnet-beta',
    rpcEndpoint: '/api/solana-rpc',
  });
  const [activeNetwork, setActiveNetwork] = useState<SolanaNetwork>('mainnet-beta');
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  // Global Wallet State
  const {
    connectedWallet,
    solBalance,
    isConnecting: isConnectingWallet,
    isRefreshingBalance,
    setWalletModalOpen,
    disconnectWallet: handleDisconnectWallet,
    refreshBalance,
  } = useSolanaWallet();

  // Form State with session draft caching (preserves inputs during wallet connection redirects)
  const [formData, setFormData] = useState<TokenCreationFormData>(() => {
    try {
      const saved = sessionStorage.getItem('surchi_token_creator_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || '',
          symbol: parsed.symbol || '',
          decimals: typeof parsed.decimals === 'number' || parsed.decimals === '' ? parsed.decimals : '',
          supply: parsed.supply || '',
          description: parsed.description || '',
          logoFile: null,
          logoPreview: parsed.logoPreview || null,
          logoUrl: parsed.logoUrl || '',
          website: parsed.website || '',
          twitter: parsed.twitter || '',
          telegram: parsed.telegram || '',
          revokeMintAuthority: Boolean(parsed.revokeMintAuthority ?? (parsed.mintAuthorityOption === 'revoke')),
          revokeFreezeAuthority: Boolean(parsed.revokeFreezeAuthority ?? (parsed.freezeAuthorityOption === 'disable')),
          revokeUpdateAuthority: Boolean(parsed.revokeUpdateAuthority),
        };
      }
    } catch {
      // ignore
    }
    return {
      name: '',
      symbol: '',
      decimals: '',
      supply: '',
      description: '',
      logoFile: null,
      logoPreview: null,
      logoUrl: '',
      website: '',
      twitter: '',
      telegram: '',
      revokeMintAuthority: false,
      revokeFreezeAuthority: false,
      revokeUpdateAuthority: false,
    };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('surchi_token_creator_draft', JSON.stringify({
        name: formData.name,
        symbol: formData.symbol,
        decimals: formData.decimals,
        supply: formData.supply,
        description: formData.description,
        logoPreview: formData.logoPreview,
        logoUrl: formData.logoUrl,
        website: formData.website,
        twitter: formData.twitter,
        telegram: formData.telegram,
        revokeMintAuthority: formData.revokeMintAuthority,
        revokeFreezeAuthority: formData.revokeFreezeAuthority,
        revokeUpdateAuthority: formData.revokeUpdateAuthority,
      }));
    } catch {
      // ignore
    }
  }, [formData]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [fileDragActive, setFileDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus and scroll refs for non-optional (required) form fields
  const nameInputRef = useRef<HTMLInputElement>(null);
  const symbolInputRef = useRef<HTMLInputElement>(null);
  const supplyInputRef = useRef<HTMLInputElement>(null);
  const decimalsInputRef = useRef<HTMLInputElement>(null);

  // Real-time validity checks for non-optional fields to indicate green
  const isNameValid = formData.name.trim().length > 0 && formData.name.trim().length <= 32;
  const isSymbolValid = formData.symbol.trim().length > 0 && formData.symbol.trim().length <= 10;
  const cleanSupplyNumber = Number(formData.supply.replace(/,/g, '').trim());
  const isSupplyValid = formData.supply.trim().length > 0 && !isNaN(cleanSupplyNumber) && cleanSupplyNumber > 0;
  const decNumber = Number(formData.decimals);
  const isDecimalsValid = formData.decimals !== ('' as any) && !isNaN(decNumber) && decNumber >= 0 && decNumber <= 9 && Number.isInteger(decNumber);

  // Execution & Progress State
  const [creationStep, setCreationStep] = useState<CreationStep>('idle');
  const [stepMessage, setStepMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<CreatedTokenRecord | null>(null);

  // History State
  const [historyTokens, setHistoryTokens] = useState<CreatedTokenRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Copy feedback states
  const [copiedMint, setCopiedMint] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Fetch Server Config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/token-creator/config');
        if (res.ok) {
          const data = await res.json();
          setConfig({
            feeSol: typeof data.feeSol === 'number' ? data.feeSol : DEFAULT_FEE_SOL,
            feeWallet: data.feeWallet || DEFAULT_FEE_WALLET,
            network: data.network || 'mainnet-beta',
            rpcEndpoint: data.rpcEndpoint || '/api/solana-rpc',
          });
          setActiveNetwork(data.network || 'mainnet-beta');
        }
      } catch (err) {
        console.warn('Could not load token creator config, using defaults:', err);
      } finally {
        setIsConfigLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Establish RPC Connection
  const getRpcConnection = () => {
    const rpcUrl = activeNetwork === 'devnet'
      ? 'https://api.devnet.solana.com'
      : (config.rpcEndpoint === '/api/solana-rpc' ? `${window.location.origin}/api/solana-rpc` : 'https://api.mainnet-beta.solana.com');
    return new Connection(rpcUrl, 'confirmed');
  };

  // Load Created Tokens History
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const query = connectedWallet ? `?creator=${connectedWallet.address}` : '';
      const res = await fetch(`/api/token-creator/history${query}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryTokens(data.tokens || []);
      }
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [connectedWallet]);

  // File Upload Handlers
  const handleFileSelect = (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setFormErrors(prev => ({ ...prev, logo: 'File must be a valid image (PNG, JPEG, WEBP, GIF, SVG).' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, logo: 'Image size cannot exceed 5MB.' }));
      return;
    }

    setFormErrors(prev => {
      const copy = { ...prev };
      delete copy.logo;
      return copy;
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        logoFile: file,
        logoPreview: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Form Validation - identifies missing non-optional fields, scrolls to & focuses the first missing field
  const validateForm = (shouldScrollToMissing = true): boolean => {
    const errors: Record<string, string> = {};
    let firstMissingKey: 'name' | 'symbol' | 'supply' | 'decimals' | 'website' | null = null;

    if (!formData.name.trim()) {
      errors.name = 'Token Name is required.';
      if (!firstMissingKey) firstMissingKey = 'name';
    } else if (formData.name.trim().length > 32) {
      errors.name = 'Token Name must be 32 characters or fewer.';
      if (!firstMissingKey) firstMissingKey = 'name';
    }

    if (!formData.symbol.trim()) {
      errors.symbol = 'Token Symbol is required.';
      if (!firstMissingKey) firstMissingKey = 'symbol';
    } else if (formData.symbol.trim().length > 10) {
      errors.symbol = 'Token Symbol must be 10 characters or fewer.';
      if (!firstMissingKey) firstMissingKey = 'symbol';
    }

    const cleanSupplyStr = formData.supply.replace(/,/g, '').trim();
    if (!cleanSupplyStr || isNaN(Number(cleanSupplyStr)) || Number(cleanSupplyStr) <= 0) {
      errors.supply = 'Total Supply must be a positive number.';
      if (!firstMissingKey) firstMissingKey = 'supply';
    }

    const decVal = Number(formData.decimals);
    if (formData.decimals === ('' as any) || isNaN(decVal) || decVal < 0 || decVal > 9 || !Number.isInteger(decVal)) {
      errors.decimals = 'Decimals must be an integer between 0 and 9.';
      if (!firstMissingKey) firstMissingKey = 'decimals';
    }

    if (formData.website && !formData.website.startsWith('http://') && !formData.website.startsWith('https://')) {
      errors.website = 'Website must start with https:// or http://';
      if (!firstMissingKey) firstMissingKey = 'website';
    }

    setFormErrors(errors);

    if (firstMissingKey && shouldScrollToMissing) {
      const fieldNames: Record<string, string> = {
        name: 'Token Name',
        symbol: 'Token Symbol',
        supply: 'Total Initial Supply',
        decimals: 'Decimals',
        website: 'Website URL',
      };

      const refMap: Record<string, React.RefObject<HTMLInputElement>> = {
        name: nameInputRef,
        symbol: symbolInputRef,
        supply: supplyInputRef,
        decimals: decimalsInputRef,
      };

      const targetRef = refMap[firstMissingKey];
      const targetElement = targetRef?.current || document.getElementById(`input-token-${firstMissingKey}`);

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          targetElement.focus();
        }, 180);
      }

      setErrorMessage(`Please fill in the required field: ${fieldNames[firstMissingKey]}.`);
    }

    return Object.keys(errors).length === 0;
  };

  // Change Handlers that clear errors dynamically when field becomes valid
  const handleNameChange = (val: string) => {
    setFormData(prev => ({ ...prev, name: val }));
    if (formErrors.name && val.trim().length > 0 && val.trim().length <= 32) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.name;
        return copy;
      });
      if (errorMessage?.includes('Token Name')) {
        setErrorMessage(null);
      }
    }
  };

  const handleSymbolChange = (val: string) => {
    const upper = val.toUpperCase();
    setFormData(prev => ({ ...prev, symbol: upper }));
    if (formErrors.symbol && upper.trim().length > 0 && upper.trim().length <= 10) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.symbol;
        return copy;
      });
      if (errorMessage?.includes('Token Symbol')) {
        setErrorMessage(null);
      }
    }
  };

  // Format Total Supply with Commas and clear error when valid
  const handleSupplyChange = (rawVal: string) => {
    const stripped = rawVal.replace(/[^0-9.]/g, '');
    const parts = stripped.split('.');
    if (parts.length > 2) return;
    const formattedWhole = parts[0] ? Number(parts[0]).toLocaleString('en-US') : '';
    const formatted = parts.length > 1 ? `${formattedWhole}.${parts[1]}` : formattedWhole;
    setFormData(prev => ({ ...prev, supply: formatted }));

    const cleanNum = Number(stripped);
    if (formErrors.supply && stripped && !isNaN(cleanNum) && cleanNum > 0) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.supply;
        return copy;
      });
      if (errorMessage?.includes('Total Supply')) {
        setErrorMessage(null);
      }
    }
  };

  const handleDecimalsChange = (val: string) => {
    if (val === '') {
      setFormData(prev => ({ ...prev, decimals: '' as any }));
    } else {
      const parsed = parseInt(val, 10);
      setFormData(prev => ({ ...prev, decimals: isNaN(parsed) ? ('' as any) : parsed }));
      if (formErrors.decimals && !isNaN(parsed) && parsed >= 0 && parsed <= 9) {
        setFormErrors(prev => {
          const copy = { ...prev };
          delete copy.decimals;
          return copy;
        });
        if (errorMessage?.includes('Decimals')) {
          setErrorMessage(null);
        }
      }
    }
  };

  // Calculate Raw Units for Preview
  let rawSupplyPreview = '0';
  try {
    const decVal = typeof formData.decimals === 'number' && !isNaN(formData.decimals)
      ? formData.decimals
      : Number(formData.decimals);
    const validDec = !isNaN(decVal) && decVal >= 0 && decVal <= 9 ? decVal : 9;
    rawSupplyPreview = calculateRawSupply(formData.supply || '0', validDec).toLocaleString();
  } catch (err) {
    rawSupplyPreview = 'Invalid amount';
  }

  // Token Creation Execution
  const handleCreateToken = async () => {
    setErrorMessage(null);

    // 1. Validate required non-optional fields FIRST - takes user back to missing form if skipped
    if (!validateForm(true)) {
      return;
    }

    // 2. Check wallet connection
    if (!connectedWallet) {
      setWalletModalOpen(true);
      return;
    }

    // 3. Balance Check: Only Solana blockchain creation fees (~0.006 SOL for rent-exemption & network tx)
    const minRequiredSol = (config.feeSol || 0) + 0.006;
    if (solBalance !== null && solBalance < minRequiredSol) {
      setErrorMessage(
        `Insufficient SOL balance. Your wallet has ${solBalance.toFixed(4)} SOL. You need ~${minRequiredSol.toFixed(3)} SOL to cover Solana blockchain token creation fees (rent-exemption and transaction fee).`
      );
      return;
    }

    try {
      setCreationStep('validating');
      setStepMessage('Validating token parameters and network availability...');

      // 4. Upload Logo if present
      let finalLogoUrl = '';
      if (formData.logoFile && formData.logoPreview) {
        setCreationStep('uploading_metadata');
        setStepMessage('Uploading token logo to persistent decentralized storage...');
        const logoRes = await fetch('/api/token-creator/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: formData.logoPreview,
            filename: formData.logoFile.name,
            mimeType: formData.logoFile.type,
          }),
        });

        if (!logoRes.ok) {
          const errData = await logoRes.json();
          throw new Error(errData.error || 'Failed to upload token logo.');
        }
        const logoData = await logoRes.json();
        finalLogoUrl = logoData.logoUrl;
      }

      // 5. Generate and Persist Metadata
      setCreationStep('uploading_metadata');
      setStepMessage('Generating Solana Metaplex standard metadata JSON...');
      const metadataRes = await fetch('/api/token-creator/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          logoUrl: finalLogoUrl,
          website: formData.website,
          twitter: formData.twitter,
          telegram: formData.telegram,
          creatorAddress: connectedWallet.address,
          decimals: formData.decimals,
          supply: formData.supply,
          network: activeNetwork,
          revokeMintAuthority: formData.revokeMintAuthority,
          revokeFreezeAuthority: formData.revokeFreezeAuthority,
          revokeUpdateAuthority: formData.revokeUpdateAuthority,
        }),
      });

      if (!metadataRes.ok) {
        const errData = await metadataRes.json();
        throw new Error(errData.error || 'Failed to generate token metadata.');
      }
      const metaData = await metadataRes.json();
      const metadataUri = metaData.metadataUri;

      // 6. Build & Submit Real SPL Token Transaction on Blockchain
      const connection = getRpcConnection();

      const result = await executeRealSplTokenCreation({
        wallet: connectedWallet,
        formData: {
          ...formData,
          logoUrl: finalLogoUrl,
        },
        network: activeNetwork,
        metadataUri,
        feeSol: config.feeSol,
        feeWalletAddress: config.feeWallet,
        connection,
        onStepChange: (step, detail) => {
          setCreationStep(step);
          if (detail) setStepMessage(detail);
        },
      });

      // 7. Authoritative Server-Side On-Chain Verification
      setCreationStep('verifying_on_chain');
      setStepMessage('Verifying mint account and initial supply on Solana ledger...');

      const verifyRes = await fetch('/api/token-creator/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txSignature: result.txSignature,
          mintAddress: result.mintAddress,
          expectedFeeSol: config.feeSol,
          expectedFeeWallet: config.feeWallet,
          network: activeNetwork,
          tokenName: formData.name,
          symbol: formData.symbol,
          totalSupply: formData.supply,
          decimals: formData.decimals,
          creatorAddress: connectedWallet.address,
          metadataUri: result.metadataUri,
          logoUrl: finalLogoUrl,
          description: formData.description,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'On-chain transaction verification failed.');
      }

      // 8. Success Confirmation
      setCreationStep('success');
      setSuccessRecord(verifyData.record);
      await refreshBalance();
      await loadHistory();
    } catch (err: any) {
      console.error('[Token Creation Error]', err);
      setCreationStep('error');
      setErrorMessage(err.message || 'An error occurred during token creation.');
    }
  };

  // Reset form for another token
  const handleResetForAnother = () => {
    setCreationStep('idle');
    setSuccessRecord(null);
    setErrorMessage(null);
    setFormErrors({});
    setFormData({
      name: '',
      symbol: '',
      decimals: 9,
      supply: '1000000',
      description: '',
      logoFile: null,
      logoPreview: null,
      logoUrl: '',
      website: '',
      twitter: '',
      telegram: '',
      revokeMintAuthority: false,
      revokeFreezeAuthority: false,
      revokeUpdateAuthority: false,
    });
  };

  const copyToClipboard = (text: string, type: 'mint' | 'tx' | 'wallet') => {
    navigator.clipboard.writeText(text);
    if (type === 'mint') {
      setCopiedMint(true);
      setTimeout(() => setCopiedMint(false), 2000);
    } else if (type === 'tx') {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    } else if (type === 'wallet') {
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16" id="surchi-token-creator-page">
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-4 border-b border-elegant-border pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <span className="text-xl sm:text-2xl shrink-0">🪙</span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight text-white truncate">
              Create Token
            </h1>
          </div>

          {/* Right Corner: Network Badge & Close Button */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            <div className="hidden sm:flex items-center space-x-2 bg-elegant-surface border border-emerald-500/30 rounded-xl px-3 py-1.5 shrink-0 text-xs font-mono text-emerald-300 font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Solana Mainnet</span>
            </div>
            <div className="sm:hidden flex items-center space-x-1.5 bg-elegant-surface border border-emerald-500/30 rounded-lg px-2 py-1 shrink-0 text-[10px] font-mono text-emerald-300 font-semibold shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Mainnet</span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border hover:border-elegant-gold/60 text-white/70 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm group"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Wallet Connection */}
        {connectedWallet ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div>
                <div className="text-xs text-elegant-text-secondary font-mono uppercase tracking-wider">
                  Connected Solana Wallet
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="font-mono text-sm font-bold text-white">
                    {connectedWallet.address.slice(0, 4)}...{connectedWallet.address.slice(-4)}
                  </span>
                  <span className="text-[10px] bg-elegant-surface border border-elegant-border text-white/70 px-2 py-0.5 rounded font-mono">
                    {connectedWallet.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(connectedWallet.address, 'wallet')}
                    className="text-elegant-text-secondary hover:text-white transition-colors cursor-pointer"
                    title="Copy wallet address"
                  >
                    {copiedWallet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={getSolscanAddressUrl(connectedWallet.address, activeNetwork)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-elegant-text-secondary hover:text-elegant-gold transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center space-x-2 bg-elegant-surface border border-elegant-border px-3 py-1.5 rounded-lg text-xs font-mono">
                <span className="text-elegant-text-secondary">Balance:</span>
                <span className="font-bold text-white">
                  {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : 'Loading...'}
                </span>
                <button
                  type="button"
                  onClick={() => refreshBalance()}
                  disabled={isRefreshingBalance}
                  className="text-elegant-text-secondary hover:text-white transition-colors cursor-pointer"
                  title="Refresh Balance"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin text-elegant-gold' : ''}`} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleDisconnectWallet}
                className="px-3 py-1.5 rounded-lg bg-elegant-surface hover:bg-red-500/20 text-elegant-text-secondary hover:text-red-300 border border-elegant-border hover:border-red-500/30 text-xs font-mono transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-bold font-mono text-xs uppercase tracking-wider transition-all shadow-md shadow-elegant-gold/10 cursor-pointer flex items-center space-x-2"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Creation Flow & Form */}
      {creationStep === 'success' && successRecord ? (
        /* SUCCESS CONFIRMATION SCREEN */
        <div className="bg-elegant-surface border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-6 animate-fade-in shadow-2xl shadow-emerald-950/20">
          <div className="flex items-center space-x-4 border-b border-elegant-border pb-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <span>Verified On-Chain</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5">
                Token Successfully Created & Verified!
              </h2>
            </div>
          </div>

          {/* Token Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-elegant-bg border border-elegant-border rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-3">
                {successRecord.logoUrl ? (
                  <img
                    src={successRecord.logoUrl}
                    alt={successRecord.tokenName}
                    className="w-12 h-12 rounded-full border border-elegant-border object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-elegant-surface border border-elegant-border flex items-center justify-center font-bold text-elegant-gold font-mono text-lg">
                    {successRecord.symbol.slice(0, 2)}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white text-lg font-mono">{successRecord.tokenName}</h3>
                  <div className="text-xs text-elegant-text-secondary font-mono">${successRecord.symbol}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-elegant-border/60 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-elegant-text-secondary">Total Supply:</span>
                  <span className="text-white font-bold">{Number(successRecord.totalSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-elegant-text-secondary">Decimals:</span>
                  <span className="text-white font-bold">{successRecord.decimals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-elegant-text-secondary">Solana Blockchain Fee:</span>
                  <span className="text-emerald-400 font-bold">{successRecord.creationFee || '~0.006 SOL'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-elegant-text-secondary">Solana Cluster:</span>
                  <span className="text-white font-bold uppercase">{successRecord.network}</span>
                </div>
              </div>
            </div>

            {/* Mint & Signature Details */}
            <div className="bg-elegant-bg border border-elegant-border rounded-xl p-4 space-y-3">
              <div>
                <div className="text-[11px] font-mono text-elegant-text-secondary uppercase tracking-wider">
                  Mint Address (Solana Contract)
                </div>
                <div className="flex items-center justify-between bg-elegant-surface border border-elegant-border px-3 py-2 rounded-lg mt-1 font-mono text-xs text-white">
                  <span className="truncate pr-2">{successRecord.mintAddress}</span>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successRecord.mintAddress, 'mint')}
                      className="p-1 hover:text-elegant-gold transition-colors cursor-pointer"
                      title="Copy Mint Address"
                    >
                      {copiedMint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={successRecord.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-elegant-gold transition-colors"
                      title="View on Solscan"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono text-elegant-text-secondary uppercase tracking-wider">
                  Transaction Signature
                </div>
                <div className="flex items-center justify-between bg-elegant-surface border border-elegant-border px-3 py-2 rounded-lg mt-1 font-mono text-xs text-white">
                  <span className="truncate pr-2">{successRecord.txSignature}</span>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successRecord.txSignature, 'tx')}
                      className="p-1 hover:text-elegant-gold transition-colors cursor-pointer"
                      title="Copy Transaction Signature"
                    >
                      {copiedTx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={successRecord.txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-elegant-gold transition-colors"
                      title="View Tx on Solscan"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono text-elegant-text-secondary uppercase tracking-wider">
                  Metaplex Metadata URI
                </div>
                <a
                  href={successRecord.metadataUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border px-3 py-2 rounded-lg mt-1 font-mono text-xs text-elegant-gold truncate transition-colors"
                >
                  <span className="truncate pr-2">{successRecord.metadataUri}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-elegant-border">
            <a
              href={successRecord.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-elegant-gold hover:bg-elegant-gold-hover text-elegant-bg font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center space-x-2"
            >
              <span>View Token on Solscan</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <a
              href={successRecord.txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-elegant-surface hover:bg-elegant-surface-hover text-white border border-elegant-border font-mono text-xs uppercase tracking-wider transition-colors flex items-center space-x-2"
            >
              <span>View Tx on Solscan</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={handleResetForAnother}
              className="px-5 py-2.5 rounded-xl bg-transparent hover:bg-elegant-surface text-elegant-text-secondary hover:text-white border border-elegant-border font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ml-auto"
            >
              Create Another Token
            </button>
          </div>
        </div>
      ) : (
        /* MAIN CREATION FORM */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Details (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-bold font-mono text-white flex items-center space-x-2 border-b border-elegant-border pb-4">
                <Coins className="w-5 h-5 text-elegant-gold" />
                <span>Token Specifications</span>
              </h2>

              {/* Token Name & Symbol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div id="field-container-name">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="input-token-name" className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center space-x-1.5">
                      <span>Token Name</span>
                      <span className="text-red-400">*</span>
                    </label>
                    {isNameValid ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded animate-fade-in">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Filled</span>
                      </span>
                    ) : formErrors.name ? (
                      <span className="text-[10px] font-mono font-bold text-red-400 flex items-center space-x-1 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        <span>Required</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      ref={nameInputRef}
                      id="input-token-name"
                      type="text"
                      placeholder="e.g. SURCHI AI Token"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      maxLength={32}
                      className={`w-full bg-elegant-bg border ${
                        formErrors.name
                          ? 'border-red-500 focus:border-red-400 bg-red-500/[0.04] ring-1 ring-red-500/30'
                          : isNameValid
                          ? 'border-emerald-500/80 focus:border-emerald-400 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20 text-white'
                          : 'border-elegant-border focus:border-elegant-gold'
                      } rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all pr-10`}
                    />
                    {isNameValid && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-emerald-400 pointer-events-none">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                  {formErrors.name && (
                    <p className="text-red-400 text-xs font-mono mt-1.5 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.name}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 font-mono mt-1">Max 32 characters</p>
                </div>

                <div id="field-container-symbol">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="input-token-symbol" className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center space-x-1.5">
                      <span>Token Symbol</span>
                      <span className="text-red-400">*</span>
                    </label>
                    {isSymbolValid ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded animate-fade-in">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Filled</span>
                      </span>
                    ) : formErrors.symbol ? (
                      <span className="text-[10px] font-mono font-bold text-red-400 flex items-center space-x-1 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        <span>Required</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      ref={symbolInputRef}
                      id="input-token-symbol"
                      type="text"
                      placeholder="e.g. SRT"
                      value={formData.symbol}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      maxLength={10}
                      className={`w-full bg-elegant-bg border ${
                        formErrors.symbol
                          ? 'border-red-500 focus:border-red-400 bg-red-500/[0.04] ring-1 ring-red-500/30'
                          : isSymbolValid
                          ? 'border-emerald-500/80 focus:border-emerald-400 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20 text-white'
                          : 'border-elegant-border focus:border-elegant-gold'
                      } rounded-xl px-4 py-3 text-sm text-white font-mono uppercase focus:outline-none transition-all pr-10`}
                    />
                    {isSymbolValid && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-emerald-400 pointer-events-none">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                  {formErrors.symbol && (
                    <p className="text-red-400 text-xs font-mono mt-1.5 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.symbol}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 font-mono mt-1">Ticker symbol, max 10 chars</p>
                </div>
              </div>

              {/* Total Supply & Decimals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div id="field-container-supply">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="input-token-supply" className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center space-x-1.5">
                      <span>Total Initial Supply</span>
                      <span className="text-red-400">*</span>
                    </label>
                    {isSupplyValid ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded animate-fade-in">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Filled</span>
                      </span>
                    ) : formErrors.supply ? (
                      <span className="text-[10px] font-mono font-bold text-red-400 flex items-center space-x-1 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        <span>Required</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      ref={supplyInputRef}
                      id="input-token-supply"
                      type="text"
                      placeholder="e.g. 1,000,000"
                      value={formData.supply}
                      onChange={(e) => handleSupplyChange(e.target.value)}
                      className={`w-full bg-elegant-bg border ${
                        formErrors.supply
                          ? 'border-red-500 focus:border-red-400 bg-red-500/[0.04] ring-1 ring-red-500/30'
                          : isSupplyValid
                          ? 'border-emerald-500/80 focus:border-emerald-400 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20 text-white'
                          : 'border-elegant-border focus:border-elegant-gold'
                      } rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all pr-10`}
                    />
                    {isSupplyValid && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-emerald-400 pointer-events-none">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                  {formErrors.supply && (
                    <p className="text-red-400 text-xs font-mono mt-1.5 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.supply}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 font-mono mt-1">
                    Raw units on-chain: <span className="text-elegant-gold">{rawSupplyPreview}</span>
                  </p>
                </div>

                <div id="field-container-decimals">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="input-token-decimals" className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center space-x-1.5">
                      <span>Decimals</span>
                      <span className="text-red-400">*</span>
                    </label>
                    {isDecimalsValid ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded animate-fade-in">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Filled</span>
                      </span>
                    ) : formErrors.decimals ? (
                      <span className="text-[10px] font-mono font-bold text-red-400 flex items-center space-x-1 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        <span>Required</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      ref={decimalsInputRef}
                      id="input-token-decimals"
                      type="number"
                      min={0}
                      max={9}
                      step={1}
                      value={formData.decimals === ('' as any) || isNaN(formData.decimals) ? '' : formData.decimals}
                      onChange={(e) => handleDecimalsChange(e.target.value)}
                      placeholder="9"
                      className={`w-full bg-elegant-bg border ${
                        formErrors.decimals
                          ? 'border-red-500 focus:border-red-400 bg-red-500/[0.04] ring-1 ring-red-500/30'
                          : isDecimalsValid
                          ? 'border-emerald-500/80 focus:border-emerald-400 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20 text-white'
                          : 'border-elegant-border focus:border-elegant-gold'
                      } rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all pr-10`}
                    />
                    {isDecimalsValid && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-emerald-400 pointer-events-none">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                  {formErrors.decimals && (
                    <p className="text-red-400 text-xs font-mono mt-1.5 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{formErrors.decimals}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 font-mono mt-1">
                    Standard is 9 for Solana SPL tokens (editable 0–9)
                  </p>
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-xs font-mono font-semibold text-white uppercase tracking-wider mb-2">
                  Token Logo (Optional)
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setFileDragActive(true); }}
                  onDragLeave={() => setFileDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setFileDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 transition-all text-center ${
                    fileDragActive
                      ? 'border-elegant-gold bg-elegant-gold/10'
                      : 'border-elegant-border hover:border-elegant-gold/50 bg-elegant-bg/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {formData.logoPreview ? (
                    <div className="flex items-center justify-center space-x-4">
                      <img
                        src={formData.logoPreview}
                        alt="Logo Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-elegant-gold/50 shadow-lg"
                      />
                      <div className="text-left font-mono">
                        <div className="text-sm font-bold text-white">{formData.logoFile?.name || 'Selected Logo'}</div>
                        <div className="text-xs text-elegant-text-secondary">
                          {formData.logoFile ? `${(formData.logoFile.size / 1024).toFixed(1)} KB` : ''}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-elegant-gold hover:underline cursor-pointer"
                          >
                            Change Image
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, logoFile: null, logoPreview: null }))}
                            className="text-xs text-red-400 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer space-y-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-elegant-surface border border-elegant-border mx-auto flex items-center justify-center text-elegant-gold">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-mono text-white font-medium">
                        Click or drag & drop token logo here
                      </div>
                      <div className="text-xs font-mono text-elegant-text-secondary">
                        PNG, JPG, WEBP, GIF, SVG (Max 5MB)
                      </div>
                    </div>
                  )}
                </div>
                {formErrors.logo && (
                  <p className="text-red-400 text-xs font-mono mt-1.5">{formErrors.logo}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono font-semibold text-white uppercase tracking-wider mb-2">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the purpose, utility, or vision of your token..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  maxLength={500}
                  className="w-full bg-elegant-bg border border-elegant-border focus:border-elegant-gold rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-colors resize-none"
                />
                <p className="text-[11px] text-white/40 font-mono mt-1">Stored permanently in token metadata JSON</p>
              </div>

              {/* Social / Project Links */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-mono uppercase tracking-wider text-elegant-text-secondary font-bold">
                  Project & Social Links (Optional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center space-x-2 bg-elegant-bg border border-elegant-border rounded-xl px-3 py-2 text-xs font-mono text-white">
                      <Globe className="w-3.5 h-3.5 text-elegant-gold shrink-0" />
                      <input
                        type="url"
                        placeholder="https://mytoken.com"
                        value={formData.website}
                        onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                        className="w-full bg-transparent focus:outline-none text-xs"
                      />
                    </div>
                    {formErrors.website && (
                      <p className="text-red-400 text-[10px] font-mono mt-1">{formErrors.website}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 bg-elegant-bg border border-elegant-border rounded-xl px-3 py-2 text-xs font-mono text-white">
                    <Twitter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="https://x.com/token"
                      value={formData.twitter}
                      onChange={(e) => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2 bg-elegant-bg border border-elegant-border rounded-xl px-3 py-2 text-xs font-mono text-white">
                    <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="https://t.me/token"
                      value={formData.telegram}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                      className="w-full bg-transparent focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Authority Settings (Mint, Freeze & Metadata Controls) */}
              <div className="border-t border-elegant-border pt-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-elegant-gold" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                      Authority Settings
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-elegant-text-secondary">
                    Checked = Revoked &bull; Unchecked = Keep Authority
                  </span>
                </div>

                <div className="space-y-3 bg-elegant-bg p-4 rounded-xl border border-elegant-border text-xs font-mono">
                  {/* Option 1: Revoke Mint Authority */}
                  <div
                    role="checkbox"
                    id="chk-revoke-mint-authority"
                    aria-checked={formData.revokeMintAuthority}
                    tabIndex={0}
                    onClick={() => setFormData(prev => ({ ...prev, revokeMintAuthority: !prev.revokeMintAuthority }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFormData(prev => ({ ...prev, revokeMintAuthority: !prev.revokeMintAuthority }));
                      }
                    }}
                    className={`group flex items-start space-x-3.5 p-3.5 rounded-lg border cursor-pointer transition-all select-none ${
                      formData.revokeMintAuthority
                        ? 'border-amber-500/70 bg-amber-500/10 shadow-sm'
                        : 'border-elegant-border bg-elegant-surface/70 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      formData.revokeMintAuthority
                        ? 'border-amber-500 bg-amber-500 text-black shadow-sm shadow-amber-500/20'
                        : 'border-white/40 bg-black/40 group-hover:border-white/80'
                    }`}>
                      {formData.revokeMintAuthority && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-white flex items-center space-x-2">
                          <Lock className={`w-3.5 h-3.5 ${formData.revokeMintAuthority ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className={formData.revokeMintAuthority ? 'text-amber-300' : 'text-white'}>
                            Revoke Mint Authority
                          </span>
                        </div>
                        {formData.revokeMintAuthority && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 text-amber-300 bg-amber-500/20 border border-amber-500/30">
                            Revoked (Fixed Supply)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-elegant-text-secondary mt-1.5 leading-relaxed">
                        {formData.revokeMintAuthority
                          ? 'Checked — Supply is permanently capped. No one (including creator) can ever mint additional supply.'
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Revoke Freeze Authority */}
                  <div
                    role="checkbox"
                    id="chk-revoke-freeze-authority"
                    aria-checked={formData.revokeFreezeAuthority}
                    tabIndex={0}
                    onClick={() => setFormData(prev => ({ ...prev, revokeFreezeAuthority: !prev.revokeFreezeAuthority }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFormData(prev => ({ ...prev, revokeFreezeAuthority: !prev.revokeFreezeAuthority }));
                      }
                    }}
                    className={`group flex items-start space-x-3.5 p-3.5 rounded-lg border cursor-pointer transition-all select-none ${
                      formData.revokeFreezeAuthority
                        ? 'border-emerald-500/70 bg-emerald-500/10 shadow-sm'
                        : 'border-elegant-border bg-elegant-surface/70 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      formData.revokeFreezeAuthority
                        ? 'border-emerald-500 bg-emerald-500 text-black shadow-sm shadow-emerald-500/20'
                        : 'border-white/40 bg-black/40 group-hover:border-white/80'
                    }`}>
                      {formData.revokeFreezeAuthority && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-white flex items-center space-x-2">
                          <Unlock className={`w-3.5 h-3.5 ${formData.revokeFreezeAuthority ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span className={formData.revokeFreezeAuthority ? 'text-emerald-300' : 'text-white'}>
                            Revoke Freeze Authority
                          </span>
                        </div>
                        {formData.revokeFreezeAuthority && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 text-emerald-300 bg-emerald-500/20 border border-emerald-500/30">
                            Revoked (Cannot Freeze)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-elegant-text-secondary mt-1.5 leading-relaxed">
                        {formData.revokeFreezeAuthority
                          ? 'Checked — Freeze authority is permanently revoked. Required for trustless trading and Raydium/Meteora DEX pools.'
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Revoke Update Authority */}
                  <div
                    role="checkbox"
                    id="chk-revoke-update-authority"
                    aria-checked={formData.revokeUpdateAuthority}
                    tabIndex={0}
                    onClick={() => setFormData(prev => ({ ...prev, revokeUpdateAuthority: !prev.revokeUpdateAuthority }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFormData(prev => ({ ...prev, revokeUpdateAuthority: !prev.revokeUpdateAuthority }));
                      }
                    }}
                    className={`group flex items-start space-x-3.5 p-3.5 rounded-lg border cursor-pointer transition-all select-none ${
                      formData.revokeUpdateAuthority
                        ? 'border-sky-500/70 bg-sky-500/10 shadow-sm'
                        : 'border-elegant-border bg-elegant-surface/70 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      formData.revokeUpdateAuthority
                        ? 'border-sky-500 bg-sky-500 text-black shadow-sm shadow-sky-500/20'
                        : 'border-white/40 bg-black/40 group-hover:border-white/80'
                    }`}>
                      {formData.revokeUpdateAuthority && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-white flex items-center space-x-2">
                          <FileText className={`w-3.5 h-3.5 ${formData.revokeUpdateAuthority ? 'text-sky-400' : 'text-slate-400'}`} />
                          <span className={formData.revokeUpdateAuthority ? 'text-sky-300' : 'text-white'}>
                            Revoke Update Authority
                          </span>
                        </div>
                        {formData.revokeUpdateAuthority && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 text-sky-300 bg-sky-500/20 border border-sky-500/30">
                            Revoked (Immutable)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-elegant-text-secondary mt-1.5 leading-relaxed">
                        {formData.revokeUpdateAuthority
                          ? 'Checked — Token metadata (name, symbol, logo, description) becomes completely immutable and fixed forever.'
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Create Action (1 col) */}
          <div className="space-y-4">
            {/* Error Alert if any */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs font-mono text-red-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Progress Indicator */}
            {creationStep !== 'idle' && creationStep !== 'error' && (
              <div className="bg-elegant-surface border border-elegant-gold/30 p-4 rounded-xl space-y-3 animate-fade-in">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-elegant-gold">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span className="uppercase tracking-wider">Creating Token On-Chain</span>
                </div>
                <p className="text-xs font-mono text-white/80">{stepMessage}</p>

                {/* Stepper Dots */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <div className={`h-1.5 rounded-full ${
                    ['validating', 'uploading_metadata', 'preparing_transaction', 'waiting_wallet_approval', 'creating_mint', 'confirming_on_chain', 'verifying_on_chain', 'success'].includes(creationStep)
                      ? 'bg-elegant-gold' : 'bg-elegant-border'
                  }`} />
                  <div className={`h-1.5 rounded-full ${
                    ['uploading_metadata', 'preparing_transaction', 'waiting_wallet_approval', 'creating_mint', 'confirming_on_chain', 'verifying_on_chain', 'success'].includes(creationStep)
                      ? 'bg-elegant-gold' : 'bg-elegant-border'
                  }`} />
                  <div className={`h-1.5 rounded-full ${
                    ['waiting_wallet_approval', 'creating_mint', 'confirming_on_chain', 'verifying_on_chain', 'success'].includes(creationStep)
                      ? 'bg-elegant-gold' : 'bg-elegant-border'
                  }`} />
                  <div className={`h-1.5 rounded-full ${
                    ['confirming_on_chain', 'verifying_on_chain', 'success'].includes(creationStep)
                      ? 'bg-emerald-400' : 'bg-elegant-border'
                  }`} />
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleCreateToken}
              disabled={creationStep !== 'idle' && creationStep !== 'error'}
              className="w-full py-3.5 px-4 rounded-xl bg-elegant-gold hover:bg-elegant-gold-hover disabled:opacity-50 text-elegant-bg font-bold font-mono text-xs uppercase tracking-wider transition-all shadow-lg shadow-elegant-gold/15 cursor-pointer flex items-center justify-center space-x-2"
            >
              {creationStep !== 'idle' && creationStep !== 'error' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing on Solana...</span>
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  <span>CREATE TOKEN 0.006 SOL</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* "My Created Tokens" History Section */}
      <div className="bg-elegant-surface border border-elegant-border rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between border-b border-elegant-border pb-4">
          <div className="flex items-center space-x-3">
            <Layers className="w-5 h-5 text-elegant-gold" />
            <h2 className="text-lg font-bold font-mono text-white">My Created Tokens</h2>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="text-xs font-mono text-elegant-text-secondary hover:text-white transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {historyTokens.length === 0 ? (
          <div className="py-12 text-center text-elegant-text-secondary font-mono text-xs">
            <Coins className="w-8 h-8 mx-auto text-white/20 mb-2" />
            <p>No tokens created yet from this session.</p>
            <p className="text-white/40 mt-1">Use the form above to mint your first SPL token on Solana.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-elegant-border text-elegant-text-secondary uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">Token</th>
                  <th className="pb-3 font-semibold">Mint Address</th>
                  <th className="pb-3 font-semibold">Supply</th>
                  <th className="pb-3 font-semibold">Network</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elegant-border/60">
                {historyTokens.map((token) => (
                  <tr key={token.id} className="hover:bg-elegant-bg/40 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center space-x-2.5">
                        {token.logoUrl ? (
                          <img src={token.logoUrl} alt={token.tokenName} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-elegant-gold/20 text-elegant-gold flex items-center justify-center font-bold text-[10px]">
                            {token.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white">{token.tokenName}</div>
                          <div className="text-[10px] text-elegant-text-secondary">${token.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-white">
                      <div className="flex items-center space-x-1.5">
                        <span>{token.mintAddress.slice(0, 4)}...{token.mintAddress.slice(-4)}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(token.mintAddress, 'mint')}
                          className="text-elegant-text-secondary hover:text-white"
                          title="Copy mint"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-white">
                      {Number(token.totalSupply).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        token.network === 'mainnet-beta'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {token.network}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-emerald-400 font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>SUCCESS</span>
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <a
                          href={token.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-elegant-text-secondary hover:text-elegant-gold transition-colors"
                          title="View on Solscan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Flow ends here */}
    </div>
  );
}
