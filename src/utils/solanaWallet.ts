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
  }
}

export const PHANTOM_ICON = '/wallets/phantom.svg';
export const SOLFLARE_ICON = '/wallets/solflare.svg';

export const PHANTOM_DOWNLOAD_URL = 'https://phantom.com/download';
export const SOLFLARE_DOWNLOAD_URL = 'https://solflare.com/download';

export const SOLANA_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

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
 * Check if the browser is running inside a wallet's in-app Web3 browser
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
 * Get available wallets list with accurate installation and platform status
 */
export function getAvailableWallets(): WalletAdapterInfo[] {
  const phantomInstalled = isPhantomInstalled();
  const solflareInstalled = isSolflareInstalled();
  const isMobile = isMobileDevice();

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://surchi.xyz';

  return [
    {
      name: 'Phantom',
      icon: PHANTOM_ICON,
      installed: phantomInstalled,
      walletUrl: PHANTOM_DOWNLOAD_URL,
      mobileAppUrl: `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://surchi.xyz')}`,
      deepLinkBrowseUrl: `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://surchi.xyz')}`
    },
    {
      name: 'Solflare',
      icon: SOLFLARE_ICON,
      installed: solflareInstalled,
      walletUrl: SOLFLARE_DOWNLOAD_URL,
      mobileAppUrl: `https://solflare.com/ul/browse/${encodeURIComponent(currentUrl)}`,
      deepLinkBrowseUrl: `https://solflare.com/ul/browse/${encodeURIComponent(currentUrl)}`
    }
  ];
}

/**
 * Build mobile universal / deep link for Phantom or Solflare
 */
export function buildMobileConnectDeepLink(
  walletName: WalletName,
  returnUrl?: string
): { universalLink: string; inAppBrowseLink: string } {
  if (typeof window === 'undefined') {
    return { universalLink: '', inAppBrowseLink: '' };
  }

  // Generate ephemeral keypair for Diffie-Hellman encryption
  const dappKeyPair = nacl.box.keyPair();
  const dappSecretKeyB58 = base58.encode(dappKeyPair.secretKey);
  const dappPublicKeyB58 = base58.encode(dappKeyPair.publicKey);

  // Store in sessionStorage to verify and decrypt upon return
  try {
    sessionStorage.setItem('surchi_wallet_dapp_secret', dappSecretKeyB58);
    sessionStorage.setItem('surchi_wallet_dapp_public', dappPublicKeyB58);
    sessionStorage.setItem('surchi_pending_wallet', walletName);
  } catch (err) {
    console.warn('[Solana Wallet] sessionStorage unavailable:', err);
  }

  const appOrigin = window.location.origin;
  const redirectTarget = returnUrl || `${window.location.origin}${window.location.pathname}?surchi_wallet_callback=1`;
  const currentFullUrl = window.location.href;

  let universalLink = '';
  let inAppBrowseLink = '';

  if (walletName === 'Phantom') {
    const params = new URLSearchParams({
      app_url: appOrigin,
      dapp_encryption_public_key: dappPublicKeyB58,
      redirect_link: redirectTarget,
      cluster: 'mainnet-beta',
    });
    universalLink = `https://phantom.app/ul/v1/connect?${params.toString()}`;
    inAppBrowseLink = `https://phantom.app/ul/browse/${encodeURIComponent(currentFullUrl)}?ref=${encodeURIComponent(appOrigin)}`;
  } else {
    // Solflare supports the standard universal connect endpoint as well as in-app browser
    const params = new URLSearchParams({
      app_url: appOrigin,
      dapp_encryption_public_key: dappPublicKeyB58,
      redirect_link: redirectTarget,
      cluster: 'mainnet-beta',
    });
    universalLink = `https://solflare.com/ul/v1/connect?${params.toString()}`;
    inAppBrowseLink = `https://solflare.com/ul/browse/${encodeURIComponent(currentFullUrl)}`;
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

  const urlParams = new URLSearchParams(window.location.search);
  const isCallback = urlParams.get('surchi_wallet_callback') === '1' || urlParams.has('phantom_encryption_public_key') || urlParams.has('solflare_encryption_public_key');

  if (!isCallback) return null;

  // Check if wallet returned error
  const errorCode = urlParams.get('errorCode');
  const errorMessage = urlParams.get('errorMessage');

  // Clean up URL parameters immediately so the URL stays pristine
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  if (errorCode || errorMessage) {
    sessionStorage.removeItem('surchi_wallet_dapp_secret');
    sessionStorage.removeItem('surchi_wallet_dapp_public');
    sessionStorage.removeItem('surchi_pending_wallet');
    
    if (errorCode === '4001' || errorMessage?.toLowerCase().includes('reject')) {
      throw new Error('Wallet connection request was rejected in your mobile wallet.');
    }
    throw new Error(errorMessage || `Wallet connection returned error code: ${errorCode}`);
  }

  const walletEncryptionPublicKeyB58 = urlParams.get('phantom_encryption_public_key') || urlParams.get('solflare_encryption_public_key') || urlParams.get('wallet_encryption_public_key');
  const nonceB58 = urlParams.get('nonce');
  const dataB58 = urlParams.get('data');

  if (!walletEncryptionPublicKeyB58 || !nonceB58 || !dataB58) {
    return null;
  }

  const dappSecretKeyB58 = sessionStorage.getItem('surchi_wallet_dapp_secret');
  const pendingWallet = (sessionStorage.getItem('surchi_pending_wallet') as WalletName) || 'Phantom';

  if (!dappSecretKeyB58) {
    throw new Error('Missing session keypair for mobile wallet decryption. Please try connecting again.');
  }

  try {
    const dappSecretKey = base58.decode(dappSecretKeyB58);
    const walletEncryptionPublicKey = base58.decode(walletEncryptionPublicKeyB58);
    const nonce = base58.decode(nonceB58);
    const data = base58.decode(dataB58);

    const sharedSecret = nacl.box.before(walletEncryptionPublicKey, dappSecretKey);
    const decrypted = nacl.box.open.after(data, nonce, sharedSecret);

    if (!decrypted) {
      throw new Error('Failed to decrypt mobile wallet authorization response.');
    }

    const payloadJson = JSON.parse(new TextDecoder().decode(decrypted));
    const userPublicKeyStr = payloadJson.public_key;

    if (!userPublicKeyStr) {
      throw new Error('Decrypted response from wallet did not contain a public key.');
    }

    const pubkey = new PublicKey(userPublicKeyStr);

    // Save session details for subsequent transactions
    sessionStorage.setItem('surchi_wallet_session', payloadJson.session || '');
    sessionStorage.setItem('surchi_wallet_encryption_pub', walletEncryptionPublicKeyB58);

    return {
      name: pendingWallet,
      publicKey: pubkey,
      address: pubkey.toBase58(),
      session: payloadJson.session,
    };
  } catch (err: any) {
    console.error('[Solana Wallet] Error decrypting mobile response:', err);
    throw new Error(err.message || 'Failed to authenticate response from mobile wallet.');
  }
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

  // If on mobile and provider is not injected, OR if forceMobileDeepLink is requested
  if (isMobile && (!provider || options?.forceMobileDeepLink)) {
    const { universalLink, inAppBrowseLink } = buildMobileConnectDeepLink(walletName);
    
    // Store in localStorage that we are pending mobile connect
    localStorage.setItem('surchi_pending_mobile_wallet', walletName);
    
    // Redirect to the wallet's mobile deep link / universal link
    window.location.href = universalLink;

    // Return a temporary promise while browser redirects
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redirecting to ${walletName} mobile application... If the app does not open automatically, please open this link in your ${walletName} in-app browser.`));
      }, 2000);
    });
  }

  // Desktop or In-App Web3 Browser
  if (!provider) {
    const downloadUrl = walletName === 'Phantom' ? PHANTOM_DOWNLOAD_URL : SOLFLARE_DOWNLOAD_URL;
    const error: any = new Error(`${walletName} wallet is not detected. Please install the ${walletName} browser extension or use the ${walletName} mobile app.`);
    error.code = 'WALLET_NOT_INSTALLED';
    error.downloadUrl = downloadUrl;
    throw error;
  }

  try {
    const connectConfig = options?.onlyIfTrusted ? { onlyIfTrusted: true } : undefined;
    const response = await provider.connect(connectConfig);
    const pubkey = provider.publicKey || response?.publicKey;

    if (!pubkey) {
      throw new Error(`Failed to retrieve public key from ${walletName}.`);
    }

    const publicKeyObj = new PublicKey(pubkey.toString());

    // Register event listeners for account change and disconnect
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

    const connectedWallet: ConnectedSolanaWallet = {
      name: walletName,
      publicKey: publicKeyObj,
      address: publicKeyObj.toBase58(),
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
    if (err?.code === 4001 || err?.message?.toLowerCase()?.includes('reject') || err?.message?.toLowerCase()?.includes('cancelled') || err?.message?.toLowerCase()?.includes('canceled')) {
      throw new Error('Connection request was cancelled or rejected in your wallet.');
    }
    if (options?.onlyIfTrusted) {
      // Silent failure on eager reconnect
      throw err;
    }
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
