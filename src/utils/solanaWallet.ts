import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaNetwork, WalletAdapterInfo } from '../types/tokenCreator';

export interface ConnectedSolanaWallet {
  name: 'Phantom' | 'Solflare';
  publicKey: PublicKey;
  address: string;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  disconnect: () => Promise<void>;
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

export function getAvailableWallets(): WalletAdapterInfo[] {
  const isPhantomInstalled = typeof window !== 'undefined' && Boolean(window?.phantom?.solana?.isPhantom || window?.solana?.isPhantom);
  const isSolflareInstalled = typeof window !== 'undefined' && Boolean(window?.solflare?.isSolflare);

  return [
    {
      name: 'Phantom',
      icon: PHANTOM_ICON,
      installed: isPhantomInstalled,
      walletUrl: 'https://phantom.com/',
    },
    {
      name: 'Solflare',
      icon: SOLFLARE_ICON,
      installed: isSolflareInstalled,
      walletUrl: 'https://solflare.com/',
    }
  ];
}

export async function connectWalletProvider(walletName: 'Phantom' | 'Solflare'): Promise<ConnectedSolanaWallet> {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined. Wallet connection must run in a browser environment.');
  }

  let provider: any = null;

  if (walletName === 'Phantom') {
    provider = window?.phantom?.solana || window?.solana;
    if (!provider || !provider.isPhantom) {
      window.open('https://phantom.app/', '_blank', 'noopener,noreferrer');
      throw new Error('Phantom wallet is not installed. Please install Phantom from https://phantom.app/');
    }
  } else if (walletName === 'Solflare') {
    provider = window?.solflare;
    if (!provider || !provider.isSolflare) {
      window.open('https://solflare.com/', '_blank', 'noopener,noreferrer');
      throw new Error('Solflare wallet is not installed. Please install Solflare from https://solflare.com/');
    }
  }

  try {
    const response = await provider.connect();
    const pubkey = provider.publicKey || response.publicKey;
    if (!pubkey) {
      throw new Error(`Failed to retrieve public key from ${walletName}.`);
    }

    const publicKeyObj = new PublicKey(pubkey.toString());

    return {
      name: walletName,
      publicKey: publicKeyObj,
      address: publicKeyObj.toBase58(),
      signTransaction: async (tx: Transaction) => {
        return await provider.signTransaction(tx);
      },
      signAllTransactions: provider.signAllTransactions
        ? async (txs: Transaction[]) => provider.signAllTransactions(txs)
        : undefined,
      disconnect: async () => {
        if (provider.disconnect) {
          await provider.disconnect();
        }
      }
    };
  } catch (err: any) {
    if (err?.code === 4001 || err?.message?.toLowerCase()?.includes('reject')) {
      throw new Error('Wallet connection request was rejected by the user.');
    }
    throw new Error(err?.message || `Failed to connect to ${walletName}.`);
  }
}

export async function fetchWalletSolBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    const lamports = await connection.getBalance(publicKey, 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.warn('[Solana] Failed to fetch balance via primary RPC, attempting fallback:', err);
    return 0;
  }
}

export function getSolscanAddressUrl(address: string, network: SolanaNetwork): string {
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/account/${address}${clusterParam}`;
}

export function getSolscanTokenUrl(mintAddress: string, network: SolanaNetwork): string {
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/token/${mintAddress}${clusterParam}`;
}

export function getSolscanTxUrl(txSignature: string, network: SolanaNetwork): string {
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${txSignature}${clusterParam}`;
}
