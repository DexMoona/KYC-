import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CreatedTokenRecord, SolanaNetwork } from '../src/types/tokenCreator';

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'tokens');
const METADATA_DIR = path.join(process.cwd(), 'public', 'metadata');
const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'created-tokens.json');

// Ensure directories exist
for (const dir of [UPLOADS_DIR, METADATA_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Ensure history file exists
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/**
 * Authoritative SURCHI fee configuration
 * Defaults to 0.2 SOL and official SURCHI fee wallet
 */
const SURCHI_DEFAULT_FEE_SOL = 0.2;
const SURCHI_DEFAULT_FEE_WALLET = '7KiihM84H4T9gCLD61HpcRGtSapk9N2H3QAsn9A5y9Ng';

export function getFeeConfig() {
  const envFee = process.env.SURCHI_TOKEN_CREATION_FEE;
  const parsedFee = envFee ? parseFloat(envFee) : SURCHI_DEFAULT_FEE_SOL;
  const feeSol = isNaN(parsedFee) || parsedFee <= 0 ? SURCHI_DEFAULT_FEE_SOL : parsedFee;
  const feeWallet = (process.env.SURCHI_FEE_WALLET || SURCHI_DEFAULT_FEE_WALLET).trim();
  const defaultNetwork: SolanaNetwork = 
    (process.env.SOLANA_NETWORK as SolanaNetwork) === 'devnet' ? 'devnet' : 'mainnet-beta';

  return {
    feeSol,
    feeWallet,
    network: defaultNetwork,
    rpcEndpoint: '/api/solana-rpc',
  };
}

function isValidRpcUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (trimmed.startsWith('https://') || trimmed.startsWith('http://')) && trimmed.length > 10;
}

/**
 * Returns the effective Solana RPC URL for a given network
 */
export function getNetworkRpcUrl(targetNetwork?: SolanaNetwork): string {
  const network = targetNetwork || (process.env.SOLANA_NETWORK as SolanaNetwork) || 'mainnet-beta';

  const customRpc = process.env.SOLANA_RPC_URL?.trim();
  if (isValidRpcUrl(customRpc)) {
    return customRpc!;
  }

  const heliusKey = process.env.HELIUS_API_KEY?.trim();
  const isRealHeliusKey = heliusKey && heliusKey.length > 15 && !heliusKey.toLowerCase().includes('surchi');
  if (isRealHeliusKey) {
    if (network === 'devnet') {
      return `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
    }
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }

  if (network === 'mainnet-beta') {
    return 'https://api.mainnet-beta.solana.com';
  }

  return 'https://api.devnet.solana.com';
}

/**
 * Helper to construct full origin URL
 */
function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim().length > 0) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

// ==========================================
// 1. CONFIGURATION ENDPOINT
// ==========================================
router.get('/api/token-creator/config', (req: Request, res: Response) => {
  const config = getFeeConfig();
  res.json({
    ...config,
    isHeliusConfigured: Boolean(process.env.HELIUS_API_KEY),
    hasCustomRpc: Boolean(process.env.SOLANA_RPC_URL),
    activeRpcUrl: getNetworkRpcUrl(config.network),
  });
});

// ==========================================
// 2. SERVER-SIDE SOLANA RPC PROXY
// Protects RPC API keys (e.g. Helius) from being exposed in browser bundles
// ==========================================
router.post('/api/solana-rpc', async (req: Request, res: Response) => {
  try {
    const networkHeader = req.headers['x-solana-network'] as SolanaNetwork | undefined;
    const rpcUrl = getNetworkRpcUrl(networkHeader);

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await rpcResponse.json();
    res.status(rpcResponse.status).json(data);
  } catch (err: any) {
    console.error('[Solana RPC Proxy] Error forwarding request:', err);
    res.status(502).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: `Solana RPC proxy error: ${err.message || 'Gateway communication failure'}`,
      },
      id: req.body?.id || null,
    });
  }
});

// ==========================================
// 3. PERSISTENT LOGO UPLOAD ENDPOINT
// ==========================================
router.post('/api/token-creator/upload-logo', async (req: Request, res: Response) => {
  try {
    const { imageBase64, filename, mimeType } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing imageBase64 data in request body.' });
    }

    const allowedMimes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/svg+xml'
    ];

    const detectedMime = mimeType || 'image/png';
    if (!allowedMimes.includes(detectedMime.toLowerCase())) {
      return res.status(400).json({
        error: `Unsupported image format: ${detectedMime}. Allowed formats: PNG, JPEG, WEBP, GIF, SVG.`
      });
    }

    // Strip data URI prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Max 5MB file size limit
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum allowed limit (5MB).' });
    }

    // Determine extension
    let extension = 'png';
    if (detectedMime.includes('jpeg') || detectedMime.includes('jpg')) extension = 'jpg';
    else if (detectedMime.includes('webp')) extension = 'webp';
    else if (detectedMime.includes('gif')) extension = 'gif';
    else if (detectedMime.includes('svg')) extension = 'svg';

    const safeName = `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);

    const baseUrl = getAppBaseUrl(req);
    const logoUrl = `/uploads/tokens/${safeName}`;
    const fullLogoUrl = `${baseUrl}${logoUrl}`;

    res.json({
      success: true,
      filename: safeName,
      logoUrl,
      fullLogoUrl,
      sizeBytes: buffer.length,
      mimeType: detectedMime,
    });
  } catch (err: any) {
    console.error('[Logo Upload] Error saving file:', err);
    res.status(500).json({ error: 'Failed to upload logo: ' + err.message });
  }
});

// ==========================================
// 4. PERSISTENT TOKEN METADATA ENDPOINTS
// ==========================================
router.post('/api/token-creator/metadata', (req: Request, res: Response) => {
  try {
    const {
      name,
      symbol,
      description,
      logoUrl,
      website,
      twitter,
      telegram,
      mintAddress,
    } = req.body;

    if (!name || !symbol) {
      return res.status(400).json({ error: 'Token name and symbol are required to generate metadata.' });
    }

    const baseUrl = getAppBaseUrl(req);
    const fullLogoUrl = logoUrl ? (logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`) : '';

    const id = (mintAddress || `token_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`).trim();

    // Standard OpenSea / Metaplex Solana Token Standard JSON
    const metadataJson = {
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      description: description?.trim() || `${name.trim()} (${symbol.trim().toUpperCase()}) token created via SURCHI Token Creator on Solana.`,
      image: fullLogoUrl,
      external_url: website?.trim() || 'https://www.surchi.xyz/',
      attributes: [
        { trait_type: 'Created With', value: 'SURCHI Solana Token Creator' },
        { trait_type: 'Decimals', value: req.body.decimals ?? 9 },
        { trait_type: 'Initial Supply', value: req.body.supply ?? '1000000' },
        { trait_type: 'Creation Network', value: req.body.network || 'Solana' },
        { trait_type: 'Mint Authority', value: req.body.revokeMintAuthority ? 'Revoked' : 'Retained' },
        { trait_type: 'Freeze Authority', value: req.body.revokeFreezeAuthority ? 'Revoked' : 'Retained' },
        { trait_type: 'Update Authority', value: req.body.revokeUpdateAuthority ? 'Revoked' : 'Retained' },
      ],
      properties: {
        files: fullLogoUrl ? [{ uri: fullLogoUrl, type: 'image/png' }] : [],
        category: 'image',
        creators: req.body.creatorAddress ? [{ address: req.body.creatorAddress, share: 100 }] : [],
      },
      extensions: {
        website: website?.trim() || '',
        twitter: twitter?.trim() || '',
        telegram: telegram?.trim() || '',
      },
    };

    const filePath = path.join(METADATA_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadataJson, null, 2), 'utf-8');

    const metadataPath = `/api/token-creator/metadata/${id}`;
    const fullMetadataUri = `${baseUrl}${metadataPath}`;

    res.json({
      success: true,
      id,
      metadataUri: fullMetadataUri,
      metadata: metadataJson,
    });
  } catch (err: any) {
    console.error('[Metadata Generation] Error creating metadata:', err);
    res.status(500).json({ error: 'Failed to generate token metadata: ' + err.message });
  }
});

router.get('/api/token-creator/metadata/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(METADATA_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Metadata not found for the requested token ID.' });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read token metadata file.' });
  }
});

// ==========================================
// 5. ON-CHAIN TRANSACTION & FEE VERIFICATION
// Verifies transaction, 0.2 SOL fee transfer, mint existence, and supply
// ==========================================
router.post('/api/token-creator/verify', async (req: Request, res: Response) => {
  try {
    const {
      txSignature,
      mintAddress,
      expectedFeeSol,
      expectedFeeWallet,
      network,
      tokenName,
      symbol,
      totalSupply,
      decimals,
      creatorAddress,
      metadataUri,
      logoUrl,
      description,
    } = req.body;

    if (!txSignature || !mintAddress) {
      return res.status(400).json({ error: 'txSignature and mintAddress are required for on-chain verification.' });
    }

    const feeConfig = getFeeConfig();
    const verifiedFeeWallet = expectedFeeWallet || feeConfig.feeWallet;
    const verifiedFeeSol = typeof expectedFeeSol === 'number' ? expectedFeeSol : feeConfig.feeSol;
    const targetNetwork: SolanaNetwork = network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';

    const rpcUrl = getNetworkRpcUrl(targetNetwork);
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[On-Chain Verification] Verifying tx ${txSignature} on ${targetNetwork}...`);

    // 1. Fetch confirmed transaction
    let tx: any = null;
    let attempts = 0;
    while (attempts < 6 && !tx) {
      attempts++;
      tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!tx) {
      return res.status(400).json({
        verified: false,
        error: 'Transaction could not be found on the Solana blockchain after multiple confirmation checks.',
      });
    }

    if (tx.meta?.err) {
      return res.status(400).json({
        verified: false,
        error: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`,
      });
    }

    // 2. Verify that 0.2 SOL reached the SURCHI fee wallet
    let feeTransferred = false;
    let feeReceivedLamports = 0;

    // Check preBalances and postBalances for the fee wallet
    const accountKeys = tx.transaction.message.staticAccountKeys 
      ? tx.transaction.message.staticAccountKeys.map((k: any) => k.toBase58 ? k.toBase58() : k.toString())
      : (tx.transaction.message.accountKeys || []).map((k: any) => k.toBase58 ? k.toBase58() : k.toString());

    const feeWalletIndex = accountKeys.indexOf(verifiedFeeWallet);
    const expectedLamports = Math.round(verifiedFeeSol * LAMPORTS_PER_SOL);

    if (feeWalletIndex !== -1 && tx.meta?.preBalances && tx.meta?.postBalances) {
      const pre = tx.meta.preBalances[feeWalletIndex];
      const post = tx.meta.postBalances[feeWalletIndex];
      feeReceivedLamports = post - pre;
      if (feeReceivedLamports >= expectedLamports) {
        feeTransferred = true;
      }
    }

    // If pre/post balance difference was within tolerance or if instruction transfer occurred
    if (!feeTransferred) {
      // Check instruction transfer in innerInstructions or logMessages
      const logs = tx.meta?.logMessages || [];
      const hasSystemTransfer = logs.some((l: string) => 
        l.includes('Program 11111111111111111111111111111111 success') ||
        l.includes('Transfer:')
      );
      if (feeWalletIndex !== -1 && hasSystemTransfer && feeReceivedLamports >= expectedLamports * 0.99) {
        feeTransferred = true;
      }
    }

    if (!feeTransferred) {
      console.warn(`[On-Chain Verification] Fee verification warning: received ${feeReceivedLamports} lamports (expected ${expectedLamports}).`);
      return res.status(400).json({
        verified: false,
        error: `Verification failed: 0.2 SOL creation fee transfer to ${verifiedFeeWallet} was not detected on-chain.`,
      });
    }

    // 3. Verify that the Mint Account exists on-chain and is owned by SPL Token Program
    const mintPubkey = new PublicKey(mintAddress);
    const mintAccountInfo = await connection.getAccountInfo(mintPubkey, 'confirmed');

    if (!mintAccountInfo) {
      return res.status(400).json({
        verified: false,
        error: `Mint account ${mintAddress} does not exist on Solana.`,
      });
    }

    if (!mintAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      return res.status(400).json({
        verified: false,
        error: `Mint account is not owned by the official Solana SPL Token program.`,
      });
    }

    // 4. Verify token supply
    let verifiedSupply = totalSupply;
    try {
      const supplyInfo = await connection.getTokenSupply(mintPubkey, 'confirmed');
      if (supplyInfo?.value?.uiAmountString) {
        verifiedSupply = supplyInfo.value.uiAmountString;
      }
    } catch (supplyErr) {
      console.warn('[On-Chain Verification] Could not fetch supply details:', supplyErr);
    }

    // 5. Construct verified record
    const baseUrl = getAppBaseUrl(req);
    const clusterQuery = targetNetwork === 'devnet' ? '?cluster=devnet' : '';

    const newRecord: CreatedTokenRecord = {
      id: mintAddress,
      creatorAddress: creatorAddress || accountKeys[0] || 'Unknown',
      tokenName: tokenName || 'SPL Token',
      symbol: (symbol || 'SPL').toUpperCase(),
      totalSupply: String(verifiedSupply || totalSupply || '0'),
      decimals: Number(decimals ?? 9),
      mintAddress,
      txSignature,
      metadataUri: metadataUri || `${baseUrl}/api/token-creator/metadata/${mintAddress}`,
      creationFee: `${verifiedFeeSol} SOL`,
      feeWallet: verifiedFeeWallet,
      timestamp: Date.now(),
      network: targetNetwork,
      status: 'SUCCESS',
      logoUrl: logoUrl || undefined,
      description: description || undefined,
      explorerUrl: `https://solscan.io/token/${mintAddress}${clusterQuery}`,
      txUrl: `https://solscan.io/tx/${txSignature}${clusterQuery}`,
    };

    // 6. Persist to data/created-tokens.json
    try {
      const existingData = fs.existsSync(HISTORY_FILE)
        ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
        : [];
      
      const filtered = existingData.filter((item: CreatedTokenRecord) => item.mintAddress !== mintAddress);
      filtered.unshift(newRecord);
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(filtered.slice(0, 200), null, 2), 'utf-8');
    } catch (writeErr) {
      console.error('[On-Chain Verification] Failed to write history file:', writeErr);
    }

    res.json({
      verified: true,
      status: 'SUCCESS',
      record: newRecord,
    });
  } catch (err: any) {
    console.error('[On-Chain Verification] Error:', err);
    res.status(500).json({
      verified: false,
      error: 'On-chain verification error: ' + (err.message || 'Unknown error'),
    });
  }
});

// ==========================================
// 6. CREATION HISTORY ENDPOINT
// ==========================================
router.get('/api/token-creator/history', (req: Request, res: Response) => {
  try {
    const { creator } = req.query;
    if (!fs.existsSync(HISTORY_FILE)) {
      return res.json({ tokens: [] });
    }

    const data: CreatedTokenRecord[] = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    if (creator && typeof creator === 'string') {
      const filtered = data.filter(
        (t) => t.creatorAddress.toLowerCase() === creator.toLowerCase()
      );
      return res.json({ tokens: filtered });
    }

    res.json({ tokens: data });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve creation history: ' + err.message });
  }
});

// ==========================================
// 7. DEVNET FAUCET HELPER ENDPOINT
// ==========================================
router.post('/api/token-creator/faucet-airdrop', async (req: Request, res: Response) => {
  try {
    const { address, amountSol = 1 } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required for airdrop.' });
    }

    const rpcUrl = getNetworkRpcUrl('devnet');
    const connection = new Connection(rpcUrl, 'confirmed');

    const pubkey = new PublicKey(address);
    const lamports = Math.min(amountSol, 2) * LAMPORTS_PER_SOL;

    const signature = await connection.requestAirdrop(pubkey, lamports);
    await connection.confirmTransaction(signature, 'confirmed');

    const newBalance = await connection.getBalance(pubkey, 'confirmed');

    res.json({
      success: true,
      signature,
      balanceSol: newBalance / LAMPORTS_PER_SOL,
    });
  } catch (err: any) {
    res.status(429).json({
      error: 'Devnet airdrop faucet is currently rate-limited by public nodes.',
      message: 'Please use official Solana web faucets: https://faucet.solana.com/ or https://solfaucet.com/',
      details: err.message,
    });
  }
});

export default router;
