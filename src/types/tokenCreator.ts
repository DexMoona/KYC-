export type SolanaNetwork = 'devnet' | 'mainnet-beta';

export interface TokenCreationConfig {
  feeSol: number;
  feeWallet: string;
  network: SolanaNetwork;
  rpcEndpoint: string;
}

export interface TokenCreationFormData {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description: string;
  logoFile: File | null;
  logoPreview: string | null;
  logoUrl: string;
  website: string;
  twitter: string;
  telegram: string;
  mintAuthorityOption: 'keep' | 'revoke' | null;
  freezeAuthorityOption: 'disable' | 'keep' | null;
}

export type CreationStep = 
  | 'idle'
  | 'validating'
  | 'uploading_metadata'
  | 'preparing_transaction'
  | 'waiting_wallet_approval'
  | 'creating_mint'
  | 'minting_supply'
  | 'processing_fee'
  | 'confirming_on_chain'
  | 'verifying_on_chain'
  | 'success'
  | 'error';

export interface CreatedTokenRecord {
  id: string;
  creatorAddress: string;
  tokenName: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  mintAddress: string;
  txSignature: string;
  metadataUri: string;
  creationFee: string;
  feeWallet: string;
  timestamp: number;
  network: SolanaNetwork;
  status: 'SUCCESS' | 'FAILED';
  logoUrl?: string;
  description?: string;
  explorerUrl: string;
  txUrl: string;
}

export interface WalletAdapterInfo {
  name: 'Phantom' | 'Solflare';
  icon: string;
  installed: boolean;
  walletUrl: string;
}
