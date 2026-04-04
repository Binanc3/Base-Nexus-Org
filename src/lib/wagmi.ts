import { http, createConfig } from 'wagmi';
import { base, mainnet, optimism, arbitrum, polygon } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { createPublicClient } from 'viem';

// ─── WalletConnect Project ID ────────────────────────────────
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

// ─── Wagmi Config ────────────────────────────────────────────
export const config = createConfig({
  chains: [base, mainnet, optimism, arbitrum, polygon],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'Base Nexus',
      preference: 'smartWalletOnly',
    }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [base.id]:     http(import.meta.env.VITE_BASE_RPC_URL     || 'https://mainnet.base.org'),
    [mainnet.id]:  http(import.meta.env.VITE_ETH_RPC_URL      || 'https://eth.llamarpc.com'),
    [optimism.id]: http(import.meta.env.VITE_OP_RPC_URL       || 'https://mainnet.optimism.io'),
    [arbitrum.id]: http(import.meta.env.VITE_ARB_RPC_URL      || 'https://arb1.arbitrum.io/rpc'),
    [polygon.id]:  http(import.meta.env.VITE_POLYGON_RPC_URL  || 'https://polygon-rpc.com'),
  },
  ssr: false,
});

// ─── Public Client ───────────────────────────────────────────
export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
});

// ─── Builder Code ────────────────────────────────────────────
//
// Your 4-byte builder referral tag — set VITE_BUILDER_CODE in .env
// without the 0x prefix. e.g. VITE_BUILDER_CODE=ca11ba5e
//
const BUILDER_CODE_HEX = (
  (import.meta.env.VITE_BUILDER_CODE as string | undefined) ?? 'ca11ba5e'
).replace(/^0x/i, '').toLowerCase();

// ✅ Exported so other components can reference the raw value
export const BASE_BUILDER_CODE = BUILDER_CODE_HEX;

// ─── Onchain Log Address ─────────────────────────────────────
//
// Address used by OnchainAI to log session summaries on Base.
// Set VITE_ONCHAIN_LOG_ADDRESS in .env to override.
// Default: sends to itself (a self-call with 0 ETH + data — safe onchain log pattern)
// You can also point this to a dedicated logging contract if you have one.
//
export const ONCHAIN_LOG_ADDRESS = (
  (import.meta.env.VITE_ONCHAIN_LOG_ADDRESS as `0x${string}` | undefined)
  ?? '0x000000000000000000000000000000000000dEaD' // default: dead address for pure data logging
) as `0x${string}`;

// ─── Builder Code Utilities ──────────────────────────────────

/**
 * Appends the builder referral code to transaction calldata.
 * - Strips any accidental 0x prefix from the suffix
 * - Validates suffix is valid even-length hex before appending
 * - Falls back safely (logs error, returns original) if suffix is invalid
 * - Use hasBuilderCode() to avoid double-appending on retries
 */
export function appendBuilderCode(data: `0x${string}`): `0x${string}` {
  const base = data && data.length > 2 ? data : '0x';

  if (
    !/^[0-9a-f]*$/.test(BUILDER_CODE_HEX) ||
    BUILDER_CODE_HEX.length % 2 !== 0
  ) {
    console.error(
      `[Builder] Invalid BUILDER_CODE: "${BUILDER_CODE_HEX}". ` +
      `Must be even-length hex without 0x prefix. Skipping append.`
    );
    return data;
  }

  return `${base}${BUILDER_CODE_HEX}` as `0x${string}`;
}

/**
 * Returns true if the builder code is already appended.
 * Use before calling appendBuilderCode() to prevent double-appending on retries.
 */
export function hasBuilderCode(data: `0x${string}`): boolean {
  return data.toLowerCase().endsWith(BUILDER_CODE_HEX);
}

/**
 * Strips the builder code suffix from calldata.
 * Useful for debugging — lets you inspect the original route data.
 */
export function stripBuilderCode(data: `0x${string}`): `0x${string}` {
  if (hasBuilderCode(data)) {
    return data.slice(0, -BUILDER_CODE_HEX.length) as `0x${string}`;
  }
  return data;
}
