/**
 * cryptoScanner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Scans scraped website content for cryptocurrency signals and optionally
 * enriches them with live on-chain data via Infura, Alchemy, Helius, and
 * Etherscan APIs.
 *
 * This feature is EXPERIMENTAL. Behavior may change frequently.
 */

import axios from 'axios';

// ── Environment vars ─────────────────────────────────────────────────────────
const INFURA_API_KEY     = process.env.INFURA_API_KEY     || '';
const ALCHEMY_API_KEY    = process.env.ALCHEMY_API_KEY    || '';
const HELIUS_API_KEY     = process.env.HELIUS_API_KEY     || '';
const ETHERSCAN_API_KEY  = process.env.ETHERSCAN_API_KEY  || '';
const SOLANA_RPC_URL     = process.env.SOLANA_RPC_URL     || 'https://api.mainnet-beta.solana.com';

// ── Crypto keyword detection ─────────────────────────────────────────────────

const STRONG_CRYPTO_KEYWORDS = [
  'bitcoin', 'ethereum', 'solana', 'crypto', 'blockchain', 'defi', 'nft', 'web3',
  'wallet', 'token', 'coin', 'altcoin', 'stablecoin', 'dao', 'dex', 'yield farming',
  'staking', 'mining', 'airdrop', 'whitepaper', 'smart contract', 'gas fee',
  'metamask', 'ledger', 'cold wallet', 'hot wallet', 'binance', 'coinbase',
  'uniswap', 'opensea', 'etherscan', 'solscan', 'polygon', 'avalanche', 'chainlink',
  'satoshi', 'hodl', 'fud', 'fomo', 'memecoin', 'shitcoin', 'pump and dump',
  'ico', 'ido', 'ipo crypto', 'presale', 'launchpad', 'tokenomics', 'roadmap crypto',
  'web 3.0', 'decentralized', 'trustless', 'permissionless',
];

/** Returns crypto keyword hits from body text */
export function detectCryptoKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return STRONG_CRYPTO_KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Determines if the content has significant enough crypto signal to warrant scanning */
export function isCryptoHeavy(bodyText: string, hits: string[]): boolean {
  // Need ≥4 distinct keywords OR at least one address/hash pattern
  if (hits.length >= 4) return true;
  // Quick pattern sniff - if an address-like string is in the text it's very likely crypto
  if (/0x[a-fA-F0-9]{40}/.test(bodyText)) return true;           // ETH address
  if (/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(bodyText)) return true; // Solana / BTC address (rough)
  return false;
}

// ── Address extraction ───────────────────────────────────────────────────────

export interface ExtractedAddresses {
  ethereum: string[];
  bitcoin: string[];
  solana: string[];
}

/** Regex-based address extraction from raw page text */
export function extractAddresses(text: string): ExtractedAddresses {
  // Ethereum: 0x followed by 40 hex chars
  const ethRegex = /\b(0x[a-fA-F0-9]{40})\b/g;
  // Bitcoin: P2PKH (1...), P2SH (3...), Bech32 (bc1...) - simplified
  const btcRegex = /\b([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,62})\b/g;
  // Solana: base58, 32-44 chars, excludes common false positives
  const solRegex = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

  const ethereum = [...new Set([...(text.match(ethRegex) || [])])];
  const bitcoin  = [...new Set([...(text.match(btcRegex) || [])])];
  // Solana needs extra filtering - dedupe and remove obvious non-addresses
  const solRaw   = [...new Set([...(text.match(solRegex) || [])])];
  const solana   = solRaw.filter(
    (s) => s.length >= 32 && !s.match(/^[a-z]+$/) && !s.match(/^\d+$/)
  ).slice(0, 10); // cap to avoid noise

  return {
    ethereum: ethereum.slice(0, 10),
    bitcoin:  bitcoin.slice(0, 10),
    solana:   solana.slice(0, 10),
  };
}

// ── On-chain enrichment ──────────────────────────────────────────────────────

export interface AddressInfo {
  address: string;
  chain: 'ethereum' | 'bitcoin' | 'solana';
  balance?: string;
  balanceUsd?: string;
  txCount?: number;
  isContract?: boolean;
  tokenName?: string;
  tokenSymbol?: string;
  tags?: string[];
  error?: string;
}

const TIMEOUT = 8000; // ms - don't block main analysis pipeline

/** Fetch Ethereum address data via Infura + Etherscan */
async function enrichEthAddress(address: string): Promise<AddressInfo> {
  const base: AddressInfo = { address, chain: 'ethereum' };
  try {
    // Balance via Infura
    if (INFURA_API_KEY) {
      const rpcRes = await axios.post(
        `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
        { jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 },
        { timeout: TIMEOUT }
      );
      const hexBalance = rpcRes.data?.result;
      if (hexBalance) {
        const weiVal = BigInt(hexBalance);
        const ethVal = Number(weiVal) / 1e18;
        base.balance = `${ethVal.toFixed(6)} ETH`;
      }
    }

    // TX count + contract check via Etherscan
    if (ETHERSCAN_API_KEY) {
      const [txRes, codeRes] = await Promise.all([
        axios.get(`https://api.etherscan.io/api`, {
          params: {
            module: 'account', action: 'txlist', address,
            startblock: 0, endblock: 99999999, page: 1, offset: 1,
            sort: 'desc', apikey: ETHERSCAN_API_KEY,
          },
          timeout: TIMEOUT,
        }),
        axios.get(`https://api.etherscan.io/api`, {
          params: { module: 'proxy', action: 'eth_getCode', address, apikey: ETHERSCAN_API_KEY },
          timeout: TIMEOUT,
        }),
      ]);
      if (txRes.data?.status === '1' && Array.isArray(txRes.data?.result)) {
        // Etherscan total from message isn't always reliable; use the normal count endpoint
        const countRes = await axios.get(`https://api.etherscan.io/api`, {
          params: { module: 'account', action: 'txlist', address, startblock: 0, endblock: 99999999, page: 1, offset: 10000, sort: 'asc', apikey: ETHERSCAN_API_KEY },
          timeout: TIMEOUT,
        });
        base.txCount = Array.isArray(countRes.data?.result) ? countRes.data.result.length : undefined;
      }
      const code = codeRes.data?.result;
      base.isContract = typeof code === 'string' && code.length > 2;
    }

    return base;
  } catch (e: any) {
    return { ...base, error: e.message };
  }
}

/** Fetch Ethereum address data via Alchemy (fallback / enrichment) */
async function enrichEthAlchemy(address: string): Promise<Partial<AddressInfo>> {
  if (!ALCHEMY_API_KEY) return {};
  try {
    const res = await axios.post(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      { jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 },
      { timeout: TIMEOUT }
    );
    const hexBalance = res.data?.result;
    if (!hexBalance) return {};
    const ethVal = Number(BigInt(hexBalance)) / 1e18;
    return { balance: `${ethVal.toFixed(6)} ETH` };
  } catch {
    return {};
  }
}

/** Fetch Solana address data via Helius */
async function enrichSolanaAddress(address: string): Promise<AddressInfo> {
  const base: AddressInfo = { address, chain: 'solana' };
  if (!HELIUS_API_KEY) return base;
  try {
    const rpcUrl = `${SOLANA_RPC_URL}/?api-key=${HELIUS_API_KEY}`;
    const balRes = await axios.post(
      rpcUrl,
      { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] },
      { timeout: TIMEOUT }
    );
    const lamports = balRes.data?.result?.value;
    if (typeof lamports === 'number') {
      base.balance = `${(lamports / 1e9).toFixed(6)} SOL`;
    }

    // Get transaction count
    const txRes = await axios.post(
      rpcUrl,
      { jsonrpc: '2.0', id: 2, method: 'getSignaturesForAddress', params: [address, { limit: 1000 }] },
      { timeout: TIMEOUT }
    );
    const sigs = txRes.data?.result;
    if (Array.isArray(sigs)) {
      base.txCount = sigs.length;
      if (sigs.length === 1000) base.tags = ['high-activity'];
    }

    return base;
  } catch (e: any) {
    return { ...base, error: e.message };
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export interface CryptoScanResult {
  /** Whether crypto is a primary focus of this site */
  has_crypto_signals: boolean;
  /** Human-readable summary */
  summary: string;
  /** Detected asset names / tickers mentioned */
  detected_assets: string[];
  /** Raw crypto-related keywords found */
  keywords: string[];
  /** Raw wallet/contract addresses found in page content */
  wallet_addresses: string[];
  /** Overall sentiment toward crypto based on keyword tone */
  sentiment: 'positive' | 'neutral' | 'negative';
  /** Risk or caution notes */
  risk_notes: string[];
  /** Detected blockchain networks */
  chain_networks: string[];
  /** On-chain enrichment details per address (only when APIs available) */
  onchain_data?: AddressInfo[];
  /** Whether live on-chain data was successfully fetched */
  onchain_enriched: boolean;
  /** Experimental feature flag */
  experimental: true;
}

/** ASSET_NAMES maps ticker patterns to friendly names */
const ASSET_PATTERNS: [RegExp, string][] = [
  [/\bbtc\b|\bbitcoin\b/i,   'Bitcoin (BTC)'],
  [/\beth\b|\bethereum\b/i,  'Ethereum (ETH)'],
  [/\bsol\b|\bsolana\b/i,    'Solana (SOL)'],
  [/\bbnb\b/i,               'BNB (BNB)'],
  [/\busdc\b/i,              'USD Coin (USDC)'],
  [/\busdt\b/i,              'Tether (USDT)'],
  [/\bmatic\b|\bpolygon\b/i, 'Polygon (MATIC)'],
  [/\bavax\b|\bavalanche\b/i,'Avalanche (AVAX)'],
  [/\blink\b|\bchainlink\b/i,'Chainlink (LINK)'],
  [/\bdoge\b|\bdogecoin\b/i, 'Dogecoin (DOGE)'],
  [/\bxrp\b|\bripple\b/i,   'XRP (Ripple)'],
  [/\bada\b|\bcardano\b/i,   'Cardano (ADA)'],
  [/\bltc\b|\blitecoin\b/i,  'Litecoin (LTC)'],
];

function detectAssets(text: string): string[] {
  const lc = text.toLowerCase();
  return ASSET_PATTERNS.filter(([re]) => re.test(lc)).map(([, name]) => name);
}

function detectNetworks(text: string): string[] {
  const lc = text.toLowerCase();
  const nets: string[] = [];
  if (/\bethereum\b|\berc-?20\b|\berc-?721\b/.test(lc)) nets.push('Ethereum');
  if (/\bsolana\b|\bspl.?token\b/.test(lc)) nets.push('Solana');
  if (/\bbitcoin\b|\bbtc\b/.test(lc)) nets.push('Bitcoin');
  if (/\bpolygon\b|\bmatic\b/.test(lc)) nets.push('Polygon');
  if (/\bavax\b|\bavalanche\b/.test(lc)) nets.push('Avalanche');
  if (/\bbnb\b|\bbsc\b|\bbinance.?smart.?chain\b/.test(lc)) nets.push('BNB Chain');
  if (/\barbitrum\b/.test(lc)) nets.push('Arbitrum');
  if (/\boptimism\b/.test(lc)) nets.push('Optimism');
  return nets;
}

function deriveSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lc = text.toLowerCase();
  const pos = ['invest', 'earn', 'grow', 'opportunity', 'gain', 'profit', 'reward', 'stake', 'yield', 'bullish', 'moon', 'launch'];
  const neg = ['scam', 'fraud', 'rug pull', 'hack', 'exploit', 'warning', 'avoid', 'risk', 'bearish', 'crash', 'ban', 'illegal', 'pump and dump'];
  const posHits = pos.filter((w) => lc.includes(w)).length;
  const negHits = neg.filter((w) => lc.includes(w)).length;
  if (negHits > posHits) return 'negative';
  if (posHits > 2) return 'positive';
  return 'neutral';
}

function buildRiskNotes(text: string, addresses: ExtractedAddresses): string[] {
  const lc = text.toLowerCase();
  const notes: string[] = [];
  if (lc.includes('rug pull') || lc.includes('exit scam')) notes.push(' Rug pull / exit scam language detected');
  if (lc.includes('pump and dump')) notes.push(' Pump-and-dump language detected');
  if (lc.includes('guaranteed return') || lc.includes('guaranteed profit')) notes.push(' Guaranteed returns claims detected - regulatory red flag');
  if (lc.includes('presale') || lc.includes('pre-sale')) notes.push('ℹ Token presale mentioned - verify legitimacy');
  if (lc.includes('unaudited')) notes.push(' Unaudited contract mentioned');
  if (addresses.ethereum.length > 3) notes.push(`ℹ ${addresses.ethereum.length} Ethereum addresses found on page`);
  if (addresses.solana.length > 3) notes.push(`ℹ ${addresses.solana.length} Solana addresses found on page`);
  return notes;
}

/**
 * Run a full crypto scan on scraped page content.
 * Always returns a result - on-chain enrichment is best-effort and won't throw.
 */
export async function runCryptoScan(
  bodyText: string,
  htmlText: string,
): Promise<CryptoScanResult> {
  const fullText = `${bodyText}\n${htmlText}`.substring(0, 150_000);

  const keywords      = detectCryptoKeywords(fullText);
  const hasCryptoSignals = isCryptoHeavy(fullText, keywords);
  const assets        = detectAssets(fullText);
  const networks      = detectNetworks(fullText);
  const addresses     = extractAddresses(fullText);
  const sentiment     = deriveSentiment(fullText);
  const riskNotes     = buildRiskNotes(fullText, addresses);

  const allAddresses  = [
    ...addresses.ethereum,
    ...addresses.bitcoin,
    ...addresses.solana,
  ];

  // ── On-chain enrichment (skip if no API keys or no addresses) ────────────
  const canEnrich = (INFURA_API_KEY || ALCHEMY_API_KEY || ETHERSCAN_API_KEY || HELIUS_API_KEY) && allAddresses.length > 0;
  let onchainData: AddressInfo[] = [];
  let onchainEnriched = false;

  if (hasCryptoSignals && canEnrich) {
    try {
      const ethJobs = addresses.ethereum.slice(0, 3).map(async (addr) => {
        const base = await enrichEthAddress(addr);
        // Fill balance from Alchemy if Infura didn't return it
        if (!base.balance && ALCHEMY_API_KEY) {
          const alchemy = await enrichEthAlchemy(addr);
          if (alchemy.balance) base.balance = alchemy.balance;
        }
        return base;
      });
      const solJobs = addresses.solana.slice(0, 3).map((addr) => enrichSolanaAddress(addr));
      // Bitcoin enrichment is read-only via public APIs - skip for now to avoid noise

      const results = await Promise.allSettled([...ethJobs, ...solJobs]);
      onchainData = results
        .filter((r): r is PromiseFulfilledResult<AddressInfo> => r.status === 'fulfilled')
        .map((r) => r.value);
      onchainEnriched = onchainData.length > 0;
    } catch {
      // Non-fatal
    }
  }

  // ── Build summary ────────────────────────────────────────────────────────
  let summary: string;
  if (!hasCryptoSignals) {
    summary = 'No significant cryptocurrency-related content detected on this page.';
  } else {
    const netStr  = networks.length  ? networks.join(', ')  : 'blockchain(s)';
    const assetStr = assets.length   ? assets.slice(0, 3).join(', ') : 'various assets';
    summary = `This page has strong cryptocurrency signals. Detected ${assetStr} on ${netStr}. ${
      allAddresses.length
        ? `${allAddresses.length} wallet/contract address(es) found.`
        : 'No wallet addresses directly embedded.'
    } ${onchainEnriched ? 'Live on-chain data was retrieved.' : 'On-chain enrichment unavailable or skipped.'}`;
  }

  return {
    has_crypto_signals: hasCryptoSignals,
    summary,
    detected_assets:  assets,
    keywords:         keywords.slice(0, 20),
    wallet_addresses: allAddresses,
    sentiment,
    risk_notes:       riskNotes,
    chain_networks:   networks,
    onchain_data:     onchainEnriched ? onchainData : undefined,
    onchain_enriched: onchainEnriched,
    experimental:     true,
  };
}
