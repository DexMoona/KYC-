import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { monitoringService } from '../services/monitoring.service';

export interface SolanaSplHolding {
  mint: string;
  balance: number;
  decimals: number;
}

export class SolanaAdapter {
  private rpcUrl: string;
  private connection: Connection;
  private cache = new Map<string, { data: any; expiry: number }>();

  constructor() {
    this.rpcUrl = this.resolveRpcUrl();
    this.connection = new Connection(this.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000
    });
  }

  private resolveRpcUrl(): string {
    const envUrl = process.env.SOLANA_RPC_URL?.trim();
    if (envUrl && envUrl.startsWith('http') && !envUrl.includes('placeholder')) {
      return envUrl;
    }
    const heliusKey = process.env.HELIUS_API_KEY?.trim();
    if (heliusKey && !heliusKey.includes('placeholder')) {
      return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    }
    return 'https://api.mainnet-beta.solana.com';
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public async getSolBalance(address: string): Promise<number> {
    const startTime = Date.now();
    try {
      const pubkey = new PublicKey(address);
      const lamports = await this.connection.getBalance(pubkey);
      monitoringService.recordSuccess('Solana Mainnet RPC', Date.now() - startTime);
      return lamports / LAMPORTS_PER_SOL;
    } catch (err: any) {
      monitoringService.recordFailure('Solana Mainnet RPC', err);
      throw err;
    }
  }

  public async getSplTokens(address: string): Promise<SolanaSplHolding[]> {
    const startTime = Date.now();
    try {
      const pubkey = new PublicKey(address);
      const accounts = await this.connection.getParsedTokenAccountsByOwner(
        pubkey,
        { programId: TOKEN_PROGRAM_ID },
        'confirmed'
      );

      const holdings: SolanaSplHolding[] = [];
      for (const { account } of accounts.value) {
        const parsedInfo = account.data.parsed?.info;
        if (!parsedInfo) continue;
        const mint = parsedInfo.mint;
        const amountStr = parsedInfo.tokenAmount?.amount;
        const decimals = parsedInfo.tokenAmount?.decimals ?? 6;
        const uiAmount = parsedInfo.tokenAmount?.uiAmount;

        if (uiAmount && uiAmount > 0) {
          holdings.push({
            mint,
            balance: uiAmount,
            decimals
          });
        }
      }

      monitoringService.recordSuccess('Solana Mainnet RPC', Date.now() - startTime);
      return holdings;
    } catch (err: any) {
      monitoringService.recordFailure('Solana Mainnet RPC', err);
      return [];
    }
  }

  public async getRecentSignatures(address: string, limit = 15): Promise<any[]> {
    const startTime = Date.now();
    try {
      const pubkey = new PublicKey(address);
      const sigs = await this.connection.getSignaturesForAddress(pubkey, { limit });
      monitoringService.recordSuccess('Solana Mainnet RPC', Date.now() - startTime);
      return sigs;
    } catch (err: any) {
      monitoringService.recordFailure('Solana Mainnet RPC', err);
      return [];
    }
  }

  public async getParsedTransactions(signatures: string[]): Promise<any[]> {
    if (!signatures || signatures.length === 0) return [];
    const startTime = Date.now();
    try {
      const parsed = await this.connection.getParsedTransactions(signatures, {
        maxSupportedTransactionVersion: 0
      });
      monitoringService.recordSuccess('Solana Mainnet RPC', Date.now() - startTime);
      return parsed.filter(Boolean);
    } catch (err: any) {
      monitoringService.recordFailure('Solana Mainnet RPC', err);
      return [];
    }
  }

  public async getTokenMintInfo(mintAddress: string): Promise<{
    supply: number;
    decimals: number;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  } | null> {
    try {
      const pubkey = new PublicKey(mintAddress);
      const acc = await this.connection.getParsedAccountInfo(pubkey);
      if (acc.value && 'parsed' in acc.value.data) {
        const info = acc.value.data.parsed.info;
        return {
          supply: info.supply ? Number(info.supply) / Math.pow(10, info.decimals || 6) : 0,
          decimals: info.decimals || 6,
          mintAuthority: info.mintAuthority || null,
          freezeAuthority: info.freezeAuthority || null
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  public async getRecentPrioritizationFees(): Promise<number> {
    try {
      const fees = await this.connection.getRecentPrioritizationFees();
      if (fees && fees.length > 0) {
        const recent = fees.slice(-20);
        const avg = recent.reduce((sum, f) => sum + f.prioritizationFee, 0) / recent.length;
        return Math.round(avg);
      }
      return 5000; // standard 5,000 microlamports fallback
    } catch {
      return 5000;
    }
  }
}

export const solanaAdapter = new SolanaAdapter();
