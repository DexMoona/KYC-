import { Buffer } from 'buffer';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMint2Instruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';
import { ConnectedSolanaWallet } from './solanaWallet';
import { CreationStep, SolanaNetwork, TokenCreationFormData } from '../types/tokenCreator';

export const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

/**
 * Packs a UTF-8 string with a 4-byte little-endian length prefix for Borsh serialization
 */
function packBorshString(str: string): Buffer {
  const buf = Buffer.from(str, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length);
  return Buffer.concat([len, buf]);
}

/**
 * Creates Metaplex Token Metadata V3 instruction data buffer
 * Discriminator = 33 (CreateMetadataAccountV3)
 */
export function createMetadataAccountV3Data(name: string, symbol: string, uri: string, isMutable = true): Buffer {
  const discriminator = Buffer.from([33]);
  const nameBuf = packBorshString(name);
  const symbolBuf = packBorshString(symbol);
  const uriBuf = packBorshString(uri);
  
  // sellerFeeBasisPoints = 0 (u16)
  const sellerFeeBuf = Buffer.alloc(2);
  sellerFeeBuf.writeUInt16LE(0);

  // creators = null (Option flag 0)
  const noCreators = Buffer.from([0]);
  // collection = null (Option flag 0)
  const noCollection = Buffer.from([0]);
  // uses = null (Option flag 0)
  const noUses = Buffer.from([0]);
  // isMutable = boolean (1 or 0)
  const mutableBuf = Buffer.from([isMutable ? 1 : 0]);
  // collectionDetails = null (Option flag 0)
  const noCollectionDetails = Buffer.from([0]);

  return Buffer.concat([
    discriminator,
    nameBuf,
    symbolBuf,
    uriBuf,
    sellerFeeBuf,
    noCreators,
    noCollection,
    noUses,
    mutableBuf,
    noCollectionDetails
  ]);
}

/**
 * Builds Metaplex CreateMetadataAccountV3 TransactionInstruction
 */
export function buildMetaplexMetadataInstruction(
  metadataPda: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  name: string,
  symbol: string,
  uri: string
): TransactionInstruction {
  const data = createMetadataAccountV3Data(name, symbol, uri, true);

  return new TransactionInstruction({
    programId: METAPLEX_TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: mintAuthority, isSigner: true, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: updateAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Safely calculates raw SPL token units from human-readable supply and decimals
 * e.g. Supply = 1,000,000, Decimals = 9 => 1000000000000000 raw units
 */
export function calculateRawSupply(supplyStr: string, decimals: number): bigint {
  const cleanSupply = supplyStr.replace(/,/g, '').trim();
  if (!cleanSupply || isNaN(Number(cleanSupply)) || Number(cleanSupply) <= 0) {
    throw new Error(`Invalid token supply amount: "${supplyStr}"`);
  }

  const parts = cleanSupply.split('.');
  const wholePart = parts[0] || '0';
  const decimalPart = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');

  const combinedStr = wholePart + decimalPart;
  const rawBigInt = BigInt(combinedStr);

  if (rawBigInt <= 0n) {
    throw new Error('Total supply must be greater than 0.');
  }

  return rawBigInt;
}

export interface ExecuteTokenCreationParams {
  wallet: ConnectedSolanaWallet;
  formData: TokenCreationFormData;
  network: SolanaNetwork;
  metadataUri: string;
  feeSol: number;
  feeWalletAddress: string;
  connection: Connection;
  onStepChange: (step: CreationStep, detail?: string) => void;
}

export interface ExecuteTokenCreationResult {
  mintAddress: string;
  txSignature: string;
  metadataUri: string;
  rawSupply: string;
  feePaidSol: number;
  feeWallet: string;
}

/**
 * Executes real SPL token creation on the Solana blockchain
 */
export async function executeRealSplTokenCreation(
  params: ExecuteTokenCreationParams
): Promise<ExecuteTokenCreationResult> {
  const {
    wallet,
    formData,
    metadataUri,
    feeSol,
    feeWalletAddress,
    connection,
    onStepChange
  } = params;

  // 1. Validate inputs
  onStepChange('validating', 'Checking parameters and wallet connection...');
  if (!wallet || !wallet.publicKey) {
    throw new Error('Wallet is not connected. Please connect Phantom or Solflare.');
  }

  const rawSupply = calculateRawSupply(formData.supply, formData.decimals);
  const feeWalletPubkey = new PublicKey(feeWalletAddress);
  const feeLamports = BigInt(Math.round(feeSol * LAMPORTS_PER_SOL));

  // 2. Check balance
  const balanceLamports = await connection.getBalance(wallet.publicKey, 'confirmed');
  const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);
  // Estimate ~0.006 SOL for rent + tx fee + SURCHI fee
  const minRequiredLamports = feeLamports + BigInt(lamportsForMint) + BigInt(2_500_000);

  if (BigInt(balanceLamports) < minRequiredLamports) {
    const currentSol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);
    const requiredSol = (Number(minRequiredLamports) / LAMPORTS_PER_SOL).toFixed(4);
    throw new Error(
      `Insufficient SOL balance. You have ${currentSol} SOL, but token creation requires ~${requiredSol} SOL (${feeSol} SOL SURCHI fee + rent/gas).`
    );
  }

  // 3. Prepare Transaction Instructions
  onStepChange('preparing_transaction', 'Building atomic SPL token instructions...');
  const mintKeypair = Keypair.generate();
  const mintPublicKey = mintKeypair.publicKey;

  // Freeze authority: only if user explicitly selected 'keep', otherwise null
  const freezeAuthority = formData.freezeAuthorityOption === 'keep' ? wallet.publicKey : null;

  // Instruction 1: Create Account for Mint
  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: mintPublicKey,
    space: MINT_SIZE,
    lamports: lamportsForMint,
    programId: TOKEN_PROGRAM_ID,
  });

  // Instruction 2: Initialize Mint
  const initMintIx = createInitializeMint2Instruction(
    mintPublicKey,
    formData.decimals,
    wallet.publicKey,
    freezeAuthority,
    TOKEN_PROGRAM_ID
  );

  // Instruction 3: Derive and Create Associated Token Account for User
  const userAta = await getAssociatedTokenAddress(
    mintPublicKey,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const createAtaIx = createAssociatedTokenAccountInstruction(
    wallet.publicKey,
    userAta,
    wallet.publicKey,
    mintPublicKey,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Instruction 4: Mint Supply to User's ATA
  const mintToIx = createMintToInstruction(
    mintPublicKey,
    userAta,
    wallet.publicKey,
    rawSupply,
    [],
    TOKEN_PROGRAM_ID
  );

  // Instruction 5: SURCHI Fixed Service Fee Transfer (0.1 SOL)
  const feeTransferIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: feeWalletPubkey,
    lamports: Number(feeLamports),
  });

  const transaction = new Transaction();
  transaction.add(createMintAccountIx);
  transaction.add(initMintIx);
  transaction.add(createAtaIx);
  transaction.add(mintToIx);
  transaction.add(feeTransferIx);

  // Optional: Metaplex Metadata Instruction
  if (metadataUri && metadataUri.trim().length > 0) {
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METAPLEX_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer()
      ],
      METAPLEX_TOKEN_METADATA_PROGRAM_ID
    );

    const metadataIx = buildMetaplexMetadataInstruction(
      metadataPda,
      mintPublicKey,
      wallet.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      formData.name.trim(),
      formData.symbol.trim(),
      metadataUri.trim()
    );
    transaction.add(metadataIx);
  }

  // Instruction (Optional): Revoke Mint Authority if user selected 'revoke'
  if (formData.mintAuthorityOption === 'revoke') {
    const revokeMintIx = createSetAuthorityInstruction(
      mintPublicKey,
      wallet.publicKey,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_PROGRAM_ID
    );
    transaction.add(revokeMintIx);
  }

  // Set latest blockhash & fee payer
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Partial sign with the new mint keypair
  transaction.partialSign(mintKeypair);

  // 4. Request user wallet approval
  onStepChange('waiting_wallet_approval', 'Please approve the transaction in your wallet...');
  let signedTx: Transaction;
  try {
    signedTx = await wallet.signTransaction(transaction);
  } catch (err: any) {
    if (err?.code === 4001 || err?.message?.toLowerCase()?.includes('reject')) {
      throw new Error('Transaction was cancelled in your wallet.');
    }
    throw new Error(`Wallet signing failed: ${err?.message || 'Unknown wallet error'}`);
  }

  // 5. Submit to Solana Blockchain
  onStepChange('confirming_on_chain', 'Broadcasting real SPL transaction to Solana network...');
  const rawTx = signedTx.serialize();
  
  let signature: string;
  try {
    signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
  } catch (sendErr: any) {
    console.error('[Solana] sendRawTransaction failed:', sendErr);
    // Parse simulation error if available
    const logs = sendErr?.logs || [];
    const logDetails = logs.length > 0 ? ` Logs: ${logs.slice(-3).join(' | ')}` : '';
    throw new Error(`Transaction simulation or broadcast failed: ${sendErr?.message || 'RPC rejection'}.${logDetails}`);
  }

  // 6. Wait for blockchain confirmation
  onStepChange('confirming_on_chain', `Waiting for confirmation on Solana (Tx: ${signature.slice(0, 8)}...)...`);
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed'
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  // 7. Verify on-chain existence
  onStepChange('verifying_on_chain', 'Verifying mint, supply, and 0.1 SOL fee on Solana ledger...');

  return {
    mintAddress: mintPublicKey.toBase58(),
    txSignature: signature,
    metadataUri,
    rawSupply: rawSupply.toString(),
    feePaidSol: feeSol,
    feeWallet: feeWalletAddress,
  };
}
