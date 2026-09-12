import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SolanaNetwork, WalletAdapterInfo } from '../types/tokenCreator';

export type { WalletAdapterInfo };

const base58 = (bs58 as any).default || bs58;

export type WalletName = 'Phantom' | 'Solflare';

export interface ConnectedSolanaWallet {
  name: WalletName;
  publicKey: PublicKey;
  address: string;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  disconnect: () => Promise<void>;
  session?: string;
  isMobileDeepLink?: boolean;
}

declare global {
  interface Window {
    solana?: any;
    phantom?: {
      solana?: any;
    };
    solflare?: any;
    __surchiWalletDebugLogs?: WalletDebugLog[];
  }
}

export const PHANTOM_ICON = '/wallets/phantom.svg';
export const SOLFLARE_ICON = '/wallets/solflare.svg';

export const PHANTOM_DOWNLOAD_URL = 'https://phantom.com/download';
export const SOLFLARE_DOWNLOAD_URL = 'https://solflare.com/download';

export const SOLANA_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

export const STORAGE_KEY_WALLET_NAME = 'surchi_connected_wallet_name';
export const STORAGE_KEY_WALLET_ADDR = 'surchi_connected_wallet_addr';
export const STORAGE_KEY_DAPP_SECRET = 'surchi_wallet_dapp_secret';
export const STORAGE_KEY_DAPP_PUBLIC = 'surchi_wallet_dapp_public';
export const STORAGE_KEY_PENDING_WALLET = 'surchi_pending_wallet';
export const STORAGE_KEY_SESSION = 'surchi_wallet_session';
export const STORAGE_KEY_WALLET_ENC_PUB = 'surchi_wallet_encryption_pub';

// ==========================================
// DEBUGGING STAGES & INTERNAL LOGGER
// ==========================================
export type WalletConnectionStage =
  | 'wallet detection'
  | 'connection URL generation'
  | 'redirect URL'
  | 'Solflare launch'
  | 'callback received'
  | 'response decryption'
  | 'public key received'
  | 'session created';

export interface WalletDebugLog {
  stage: WalletConnectionStage;
  timestamp: string;
  status: 'info' | 'success' | 'error';
  message: string;
  meta?: Record<string, any>;
}

export const walletDebugLogs: WalletDebugLog[] = [];

if (typeof window !== 'undefined') {
  window.__surchiWalletDebugLogs = walletDebugLogs;
}

/**
 * Log internal wallet connection stages.
 * IMPORTANT: Strictly avoids exposing secret keys, private keys, or seed phrases.
 */
export function logWalletStage(
  stage: WalletConnectionStage,
  status: 'info' | 'success' | 'error',
  message: string,
  meta?: Record<string, any>
) {
  const entry: WalletDebugLog = {
    stage,
    timestamp: new Date().toISOString(),
    status,
    message,
    meta,
  };
  walletDebugLogs.push(entry);

  const prefix = `[Wallet Debug | ${stage.toUpperCase()}]`;
  if (status === 'error') {
    console.error(prefix, message, meta || '');
  } else if (status === 'success') {
    console.log(`%c${prefix} ${message}`, 'color: #10B981; font-weight: bold;', meta || '');
  } else {
    console.log(prefix, message, meta || '');
  }
}

/**
 * Mobile Device Detection
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if running inside in-app wallet Web3 browser
 */
export function isInAppWalletBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const isPhantom = Boolean(window?.phantom?.solana?.isPhantom || window?.solana?.isPhantom);
  const isSolflare = Boolean(window?.solflare?.isSolflare);
  return isMobileDevice() && (isPhantom || isSolflare);
}

/**
 * Check if Phantom provider is injected
 */
export function isPhantomInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window?.phantom?.solana?.isPhantom || window?.solana?.isPhantom);
}

/**
 * Check if Solflare provider is injected
 */
export function isSolflareInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window?.solflare?.isSolflare);
}

/**
 * Retrieve Phantom provider
 */
export function getPhantomProvider(): any {
  if (typeof window === 'undefined') return null;
  if (window?.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }
  if (window?.solana?.isPhantom) {
    return window.solana;
  }
  return null;
}

/**
 * Retrieve Solflare provider
 */
export function getSolflareProvider(): any {
  if (typeof window === 'undefined') return null;
  if (window?.solflare?.isSolflare) {
    return window.solflare;
  }
  return null;
}

/**
 * Get verified application HTTPS Base URL
 * Ensures Solflare/Phantom receives a valid production HTTPS URL, avoiding localhost in mobile flow.
 */
export function getApplicationHttpsUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://ais-dev-woosd66qxpftaefeypzsb2-619824145342.europe-west2.run.app';
  }

  const origin = window.location.origin;
  // If running on live HTTPS (e.g. Cloud Run, domain), use the exact origin
  if (origin && origin.startsWith('https://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    return origin;
  }

  // Fallback to verified production deployment URL for mobile flow
  return 'https://ais-dev-woosd66qxpftaefeypzsb2-619824145342.europe-west2.run.app';
}

/**
 * Get verified application HTTPS Callback / Redirect URL
 * Strictly without query parameters, matching the dApp origin.
 */
export function getApplicationHttpsRedirectUrl(): string {
  const baseUrl = getApplicationHttpsUrl();
  const pathname = typeof window !== 'undefined' && window.location.pathname ? window.location.pathname : '/';
  const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get available wallets list with accurate installation and platform status
 */
export function getAvailableWallets(): WalletAdapterInfo[] {
  const phantomInstalled = isPhantomInstalled();
  const solflareInstalled = isSolflareInstalled();
  const appHttpsUrl = getApplicationHttpsUrl();

  return [
    {
      name: 'Solflare',
      icon: SOLFLARE_ICON,
      installed: solflareInstalled,
      walletUrl: SOLFLARE_DOWNLOAD_URL,
      mobileAppUrl: `https://solflare.com/ul/browse/${encodeURIComponent(appHttpsUrl)}`,
      deepLinkBrowseUrl: `https://solflare.com/ul/browse/${encodeURIComponent(appHttpsUrl)}`
    },
    {
      name: 'Phantom',
      icon: PHANTOM_ICON,
      installed: phantomInstalled,
      walletUrl: PHANTOM_DOWNLOAD_URL,
      mobileAppUrl: `https://phantom.app/ul/browse/${encodeURIComponent(appHttpsUrl)}?ref=${encodeURIComponent(appHttpsUrl)}`,
      deepLinkBrowseUrl: `https://phantom.app/ul/browse/${encodeURIComponent(appHttpsUrl)}?ref=${encodeURIComponent(appHttpsUrl)}`
    }
  ];
}

/**
 * Build official Solflare Universal Link for Connect method
 * Protocol: https://solflare.com/ul/v1/connect?app_url=...&dapp_encryption_public_key=...&redirect_link=...&cluster=mainnet-beta
 */
export function buildSolflareUniversalConnectUrl(
  appUrl: string,
  dappPublicKeyB58: string,
  redirectLink: string,
  cluster: string = 'mainnet-beta'
): string {
  logWalletStage('redirect URL', 'info', 'Verified Solflare HTTPS callback configuration', {
    app_url: appUrl,
    redirect_link: redirectLink,
  });

  const encodedAppUrl = encodeURIComponent(appUrl);
  const encodedDappKey = encodeURIComponent(dappPublicKeyB58);
  const encodedRedirect = encodeURIComponent(redirectLink);

  const url = `https://solflare.com/ul/v1/connect?app_url=${encodedAppUrl}&dapp_encryption_public_key=${encodedDappKey}&redirect_link=${encodedRedirect}&cluster=${cluster}`;

  logWalletStage('connection URL generation', 'success', 'Generated official Solflare Universal Link connect URL', {
    endpoint: 'https://solflare.com/ul/v1/connect',
    cluster,
    app_url: appUrl,
    dapp_encryption_public_key_preview: `${dappPublicKeyB58.slice(0, 6)}...${dappPublicKeyB58.slice(-4)}`,
  });

  return url;
}

/**
 * Build official Phantom Universal Link for Connect method
 */
export function buildPhantomUniversalConnectUrl(
  appUrl: string,
  dappPublicKeyB58: string,
  redirectLink: string,
  cluster: string = 'mainnet-beta'
): string {
  logWalletStage('redirect URL', 'info', 'Verified Phantom HTTPS callback configuration', {
    app_url: appUrl,
    redirect_link: redirectLink,
  });

  const encodedAppUrl = encodeURIComponent(appUrl);
  const encodedDappKey = encodeURIComponent(dappPublicKeyB58);
  const encodedRedirect = encodeURIComponent(redirectLink);

  const url = `https://phantom.app/ul/v1/connect?app_url=${encodedAppUrl}&dapp_encryption_public_key=${encodedDappKey}&redirect_link=${encodedRedirect}&cluster=${cluster}`;

  logWalletStage('connection URL generation', 'success', 'Generated official Phantom Universal Link connect URL', {
    endpoint: 'https://phantom.app/ul/v1/connect',
    cluster,
    app_url: appUrl,
    dapp_encryption_public_key_preview: `${dappPublicKeyB58.slice(0, 6)}...${dappPublicKeyB58.slice(-4)}`,
  });

  return url;
}

/**
 * Build mobile universal link for Solflare or Phantom
 */
export function buildMobileConnectDeepLink(
  walletName: WalletName
): { universalLink: string; inAppBrowseLink: string } {
  if (typeof window === 'undefined') {
    return { universalLink: '', inAppBrowseLink: '' };
  }

  // 1. Generate fresh x25519 keypair for session Diffie-Hellman encryption
  const dappKeyPair = nacl.box.keyPair();
  const dappSecretKeyB58 = base58.encode(dappKeyPair.secretKey);
  const dappPublicKeyB58 = base58.encode(dappKeyPair.publicKey);

  // 2. Persist in both localStorage and sessionStorage so it survives mobile tab switches
  try {
    localStorage.setItem(STORAGE_KEY_DAPP_SECRET, dappSecretKeyB58);
    localStorage.setItem(STORAGE_KEY_DAPP_PUBLIC, dappPublicKeyB58);
    localStorage.setItem(STORAGE_KEY_PENDING_WALLET, walletName);
    localStorage.setItem('surchi_wallet_connect_time', Date.now().toString());

    sessionStorage.setItem(STORAGE_KEY_DAPP_SECRET, dappSecretKeyB58);
    sessionStorage.setItem(STORAGE_KEY_DAPP_PUBLIC, dappPublicKeyB58);
    sessionStorage.setItem(STORAGE_KEY_PENDING_WALLET, walletName);
  } catch (err) {
    console.warn('[Solana Wallet] Storage warning:', err);
  }

  // 3. Resolve HTTPS application URL and clean redirect URL
  const appHttpsUrl = getApplicationHttpsUrl();
  const redirectHttpsUrl = getApplicationHttpsRedirectUrl();

  let universalLink = '';
  let inAppBrowseLink = '';

  if (walletName === 'Solflare') {
    universalLink = buildSolflareUniversalConnectUrl(appHttpsUrl, dappPublicKeyB58, redirectHttpsUrl, 'mainnet-beta');
    inAppBrowseLink = `https://solflare.com/ul/browse/${encodeURIComponent(appHttpsUrl)}`;
  } else {
    universalLink = buildPhantomUniversalConnectUrl(appHttpsUrl, dappPublicKeyB58, redirectHttpsUrl, 'mainnet-beta');
    inAppBrowseLink = `https://phantom.app/ul/browse/${encodeURIComponent(appHttpsUrl)}?ref=${encodeURIComponent(appHttpsUrl)}`;
  }

  return { universalLink, inAppBrowseLink };
}

/**
 * Handle incoming callback parameters after mobile wallet approval redirect
 */
export function handleMobileConnectCallback(): {
  name: WalletName;
  publicKey: PublicKey;
  address: string;
  session?: string;
} | null {
  if (typeof window === 'undefined') return null;

  // Robust query parser that handles duplicate '?' or mixed encoding
  let searchString = window.location.search;
  if (!searchString) return null;

  if (searchString.startsWith('?')) {
    searchString = searchString.slice(1);
  }
  // Replace any subsequent '?' with '&' if wallet appended directly
  searchString = searchString.split('?').join('&');
  const urlParams = new URLSearchParams(searchString);

  const hasSolflareKey = urlParams.has('solflare_encryption_public_key');
  const hasPhantomKey = urlParams.has('phantom_encryption_public_key');
  const hasGenericKey = urlParams.has('wallet_encryption_public_key');
  const hasErrorCode = urlParams.has('errorCode') || urlParams.has('error') || urlParams.has('code');

  if (!hasSolflareKey && !hasPhantomKey && !hasGenericKey && !hasErrorCode) {
    return null;
  }

  logWalletStage('callback received', 'info', 'Detected wallet callback query parameters', {
    hasSolflareKey,
    hasPhantomKey,
    hasGenericKey,
    hasErrorCode,
  });

  // Check if wallet returned user rejection or error
  const errorCode = urlParams.get('errorCode') || urlParams.get('code');
  const errorMessage = urlParams.get('errorMessage') || urlParams.get('message') || urlParams.get('error');

  // Clean up address bar query parameters immediately
  const cleanPath = window.location.pathname;
  window.history.replaceState({}, document.title, cleanPath);

  if (errorCode || errorMessage) {
    logWalletStage('callback received', 'error', 'Wallet returned rejection or error code', {
      errorCode,
      errorMessage,
    });

    // Clear pending session keys
    localStorage.removeItem(STORAGE_KEY_DAPP_SECRET);
    localStorage.removeItem(STORAGE_KEY_DAPP_PUBLIC);
    sessionStorage.removeItem(STORAGE_KEY_DAPP_SECRET);
    sessionStorage.removeItem(STORAGE_KEY_DAPP_PUBLIC);

    // Requirement 11: If the user rejects the request, show "Connection cancelled"
    const isUserRejection =
      errorCode === '4001' ||
      errorCode === '-32003' ||
      errorMessage?.toLowerCase().includes('reject') ||
      errorMessage?.toLowerCase().includes('cancel') ||
      errorMessage?.toLowerCase().includes('user');

    const err = new Error(isUserRejection ? 'Connection cancelled' : (errorMessage || `Wallet returned error code: ${errorCode}`));
    (err as any).isCancellation = isUserRejection;
    throw err;
  }

  const walletEncryptionPublicKeyB58 =
    urlParams.get('solflare_encryption_public_key') ||
    urlParams.get('phantom_encryption_public_key') ||
    urlParams.get('wallet_encryption_public_key');
  const nonceB58 = urlParams.get('nonce');
  const dataB58 = urlParams.get('data');

  if (!walletEncryptionPublicKeyB58 || !nonceB58 || !dataB58) {
    logWalletStage('callback received', 'error', 'Missing required encrypted payload parameters (wallet key, nonce, or data)');
    return null;
  }

  const dappSecretKeyB58 =
    localStorage.getItem(STORAGE_KEY_DAPP_SECRET) ||
    sessionStorage.getItem(STORAGE_KEY_DAPP_SECRET);

  const pendingWallet = (
    localStorage.getItem(STORAGE_KEY_PENDING_WALLET) ||
    sessionStorage.getItem(STORAGE_KEY_PENDING_WALLET) ||
    (hasSolflareKey ? 'Solflare' : 'Phantom')
  ) as WalletName;

  if (!dappSecretKeyB58) {
    logWalletStage('response decryption', 'error', 'Missing local ephemeral session secret key');
    throw new Error('Missing session keypair for mobile wallet decryption. Please try connecting again.');
  }

  // 4. Decrypt Diffie-Hellman response
  logWalletStage('response decryption', 'info', 'Commencing TweetNaCl response decryption');
  let payloadJson: any;
  try {
    const dappSecretKey = base58.decode(dappSecretKeyB58);
    const walletEncryptionPublicKey = base58.decode(walletEncryptionPublicKeyB58);
    const nonce = base58.decode(nonceB58);
    const data = base58.decode(dataB58);

    const sharedSecret = nacl.box.before(walletEncryptionPublicKey, dappSecretKey);
    const decrypted = nacl.box.open.after(data, nonce, sharedSecret);

    if (!decrypted) {
      logWalletStage('response decryption', 'error', 'TweetNaCl box.open.after decryption returned falsy');
      throw new Error('Failed to decrypt mobile wallet authorization response.');
    }

    const decryptedString = new TextDecoder().decode(decrypted);
    payloadJson = JSON.parse(decryptedString);
    logWalletStage('response decryption', 'success', 'Successfully decrypted mobile wallet payload');
  } catch (err: any) {
    logWalletStage('response decryption', 'error', err?.message || 'Decryption threw an exception');
    throw new Error(err.message || 'Failed to authenticate response from mobile wallet.');
  }

  // 5. Extract and validate returned public_key
  const userPublicKeyStr = payloadJson.public_key;
  if (!userPublicKeyStr) {
    logWalletStage('public key received', 'error', 'Decrypted payload did not contain public_key');
    throw new Error('Decrypted response from wallet did not contain a public key.');
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(userPublicKeyStr);
  } catch (err: any) {
    logWalletStage('public key received', 'error', `Invalid public key string: ${err?.message}`);
    throw new Error('Invalid public key returned by mobile wallet.');
  }

  const address = pubkey.toBase58();
  logWalletStage('public key received', 'success', `Validated real Solana address: ${address.slice(0, 4)}...${address.slice(-4)}`);

  // 6. Store session securely
  const sessionToken = payloadJson.session || '';
  try {
    localStorage.setItem(STORAGE_KEY_WALLET_NAME, pendingWallet);
    localStorage.setItem(STORAGE_KEY_WALLET_ADDR, address);
    if (sessionToken) {
      localStorage.setItem(STORAGE_KEY_SESSION, sessionToken);
      sessionStorage.setItem(STORAGE_KEY_SESSION, sessionToken);
    }
    localStorage.setItem(STORAGE_KEY_WALLET_ENC_PUB, walletEncryptionPublicKeyB58);

    // Clean ephemeral keypairs
    localStorage.removeItem(STORAGE_KEY_DAPP_SECRET);
    localStorage.removeItem(STORAGE_KEY_DAPP_PUBLIC);
    sessionStorage.removeItem(STORAGE_KEY_DAPP_SECRET);
    sessionStorage.removeItem(STORAGE_KEY_DAPP_PUBLIC);
  } catch (storageErr) {
    console.warn('[Solana Wallet] Error saving session to storage:', storageErr);
  }

  logWalletStage('session created', 'success', `Created active session for ${pendingWallet}`, {
    addressPrefix: address.slice(0, 4),
    addressSuffix: address.slice(-4),
    hasSessionToken: Boolean(sessionToken),
  });

  return {
    name: pendingWallet,
    publicKey: pubkey,
    address,
    session: sessionToken,
  };
}

/**
 * Connect to Solana Wallet provider (Desktop extension, in-app browser, or Mobile deep link)
 */
export async function connectWalletProvider(
  walletName: WalletName,
  options?: {
    onlyIfTrusted?: boolean;
    forceMobileDeepLink?: boolean;
    onAccountChange?: (newPubkey: PublicKey | null) => void;
    onDisconnect?: () => void;
  }
): Promise<ConnectedSolanaWallet> {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined. Wallet connection must run in a browser environment.');
  }

  const isMobile = isMobileDevice();
  let provider: any = null;

  if (walletName === 'Phantom') {
    provider = getPhantomProvider();
  } else if (walletName === 'Solflare') {
    provider = getSolflareProvider();
  }

  logWalletStage('wallet detection', 'info', `Evaluating ${walletName} connection options`, {
    walletName,
    isMobile,
    hasProvider: Boolean(provider),
    onlyIfTrusted: Boolean(options?.onlyIfTrusted),
  });

  // MOBILE FLOW:
  // If on mobile and provider is not injected, OR forceMobileDeepLink requested
  if (isMobile && (!provider || options?.forceMobileDeepLink)) {
    // DO NOT REDIRECT AUTOMATICALLY ON PAGE LOAD (onlyIfTrusted = true)
    if (options?.onlyIfTrusted) {
      logWalletStage('wallet detection', 'warn', 'Skipping mobile deep link auto-reconnect to prevent unwanted wallet app launch.');
      throw new Error('Eager reconnect not supported via mobile deep links. User must click connect.');
    }

    const { universalLink, inAppBrowseLink } = buildMobileConnectDeepLink(walletName);

    logWalletStage(
      walletName === 'Solflare' ? 'Solflare launch' : 'connection URL generation',
      'info',
      `Launching ${walletName} mobile application via official Universal Link`
    );

    // Set pending wallet state
    localStorage.setItem(STORAGE_KEY_PENDING_WALLET, walletName);

    // Open the official Universal Link for Connect method
    window.location.href = universalLink;

    // Return a pending promise while the OS redirects to the wallet app
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Opening ${walletName} mobile app... If ${walletName} does not open automatically, please ensure the app is installed or open this site in your ${walletName} in-app browser.`));
      }, 2500);
    });
  }

  // DESKTOP FLOW:
  // Requirement 4 & 12: If Solflare/Phantom is not installed on desktop, show install option
  if (!provider) {
    logWalletStage('wallet detection', 'error', `${walletName} browser extension provider not detected on desktop`);
    const downloadUrl = walletName === 'Phantom' ? PHANTOM_DOWNLOAD_URL : SOLFLARE_DOWNLOAD_URL;
    const error: any = new Error(`${walletName} wallet extension is not detected. Please install ${walletName} from ${walletName.toLowerCase()}.com to connect.`);
    error.code = 'WALLET_NOT_INSTALLED';
    error.downloadUrl = downloadUrl;
    throw error;
  }

  logWalletStage('wallet detection', 'success', `Requesting connection through ${walletName} provider`);

  try {
    const connectConfig = options?.onlyIfTrusted ? { onlyIfTrusted: true } : undefined;
    const response = await provider.connect(connectConfig);
    const pubkey = provider.publicKey || response?.publicKey;

    if (!pubkey) {
      throw new Error(`Failed to retrieve public key from ${walletName}.`);
    }

    const publicKeyObj = new PublicKey(pubkey.toString());
    const address = publicKeyObj.toBase58();

    logWalletStage('public key received', 'success', `Desktop provider connected with address: ${address.slice(0, 4)}...${address.slice(-4)}`);

    // Register provider event listeners
    if (provider.on) {
      provider.on('accountChanged', (newKey: any) => {
        if (newKey) {
          try {
            const updatedKey = new PublicKey(newKey.toString());
            options?.onAccountChange?.(updatedKey);
          } catch (e) {
            options?.onAccountChange?.(null);
          }
        } else {
          options?.onAccountChange?.(null);
        }
      });

      provider.on('disconnect', () => {
        options?.onDisconnect?.();
      });
    }

    logWalletStage('session created', 'success', `Active desktop session established for ${walletName}`);

    const connectedWallet: ConnectedSolanaWallet = {
      name: walletName,
      publicKey: publicKeyObj,
      address,
      signTransaction: async (tx: Transaction) => {
        if (!provider.signTransaction) {
          throw new Error(`${walletName} does not support signTransaction method.`);
        }
        return await provider.signTransaction(tx);
      },
      signAllTransactions: provider.signAllTransactions
        ? async (txs: Transaction[]) => provider.signAllTransactions(txs)
        : undefined,
      disconnect: async () => {
        if (provider.disconnect) {
          try {
            await provider.disconnect();
          } catch (e) {
            // Ignore clean disconnect errors
          }
        }
      }
    };

    return connectedWallet;
  } catch (err: any) {
    if (
      err?.code === 4001 ||
      err?.code === -32003 ||
      err?.message?.toLowerCase()?.includes('reject') ||
      err?.message?.toLowerCase()?.includes('cancelled') ||
      err?.message?.toLowerCase()?.includes('canceled')
    ) {
      logWalletStage('wallet detection', 'info', 'User cancelled connection in wallet extension');
      const cancelErr = new Error('Connection cancelled');
      (cancelErr as any).isCancellation = true;
      throw cancelErr;
    }
    if (options?.onlyIfTrusted) {
      throw err;
    }
    logWalletStage('wallet detection', 'error', err?.message || `Failed to connect to ${walletName}`);
    throw new Error(err?.message || `Failed to connect to ${walletName}.`);
  }
}

/**
 * Fetch live confirmed SOL balance on Solana mainnet-beta
 */
export async function fetchWalletSolBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    const lamports = await connection.getBalance(publicKey, 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.warn('[Solana] Failed to fetch balance via primary RPC, attempting fallback:', err);
    try {
      const fallbackConn = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
      const lamports = await fallbackConn.getBalance(publicKey, 'confirmed');
      return lamports / LAMPORTS_PER_SOL;
    } catch (fallbackErr) {
      console.warn('[Solana] Fallback balance check failed:', fallbackErr);
      return 0;
    }
  }
}

/**
 * Solscan Explorer URLs
 */
export function getSolscanAddressUrl(address: string, network: SolanaNetwork = 'mainnet-beta'): string {
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/account/${address}${clusterParam}`;
}

export function getSolscanTokenUrl(mintAddress: string, network: SolanaNetwork = 'mainnet-beta'): string {
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/token/${mintAddress}${clusterParam}`;
}

export function getSolscanTxUrl(txSignature: string, network: SolanaNetwork = 'mainnet-beta'): string {
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${txSignature}${clusterParam}`;
}

