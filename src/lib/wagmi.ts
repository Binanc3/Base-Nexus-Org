// ============================================================
// src/lib/wagmi.ts
// Wagmi config + builder code utility
// ============================================================

import { http, createConfig } from 'wagmi';
import { base, mainnet, optimism, arbitrum, polygon } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { createPublicClient } from 'viem';

// ─── WalletConnect Project ID ────────────────────────────────
// Set VITE_WALLETCONNECT_PROJECT_ID in your .env
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

// ─── Wagmi Config ────────────────────────────────────────────
export const config = createConfig({
  chains: [base, mainnet, optimism, arbitrum, polygon],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'Base Nexus',
      preference: 'smartWalletOnly', // Prefer Coinbase Smart Wallet on Base
    }),
    ...(projectId
      ? [walletConnect({ projectId })]
      : []),
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

// ─── Public Client (for direct viem calls) ───────────────────
export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
});

// ─── Builder Code ────────────────────────────────────────────
//
// The Coinbase/Base "builder code" is a 4-byte referral tag appended
// to the END of any transaction's calldata. It does NOT start with 0x —
// it is raw hex appended after the existing encoded calldata.
//
// Your project's builder tag should be set in VITE_BUILDER_CODE (without 0x).
// Fallback is the OnchainKit default demo tag.
//
const BUILDER_CODE_HEX = (
  import.meta.env.VITE_BUILDER_CODE as string | undefined
  ?? 'ca11ba5e' // default OnchainKit builder tag — replace with your actual tag
).replace(/^0x/i, '').toLowerCase(); // strip any accidental 0x prefix

/**
 * Appends the builder referral code to transaction calldata.
 *
 * Rules:
 *  - Input must be a valid 0x-prefixed hex string
 *  - Suffix is appended raw (no separator, no 0x)
 *  - Returns a valid `0x${string}` ready for sendTransaction
 *
 * @param data - Original transaction calldata from the route/quote
 * @returns Modified calldata with builder code appended
 */
export function appendBuilderCode(data: `0x${string}`): `0x${string}` {
  // Guard: if data is empty or just '0x', still append correctly
  const base = data && data.length > 2 ? data : '0x';

  // Validate builder code is valid hex (even number of chars, hex chars only)
  if (!/^[0-9a-f]*$/.test(BUILDER_CODE_HEX) || BUILDER_CODE_HEX.length % 2 !== 0) {
    console.error(
      `[Builder] Invalid BUILDER_CODE: "${BUILDER_CODE_HEX}". ` +
      `Must be even-length hex without 0x prefix. Skipping append.`
    );
    return data;
  }

  return `${base}${BUILDER_CODE_HEX}` as `0x${string}`;
}

/**
 * Strips the builder code from calldata (useful for debugging or verification).
 */
export function stripBuilderCode(data: `0x${string}`): `0x${string}` {
  if (data.endsWith(BUILDER_CODE_HEX)) {
    return data.slice(0, -BUILDER_CODE_HEX.length) as `0x${string}`;
  }
  return data;
}

/**
 * Checks whether calldata already has the builder code appended.
 * Use this to avoid double-appending on retries.
 */
export function hasBuilderCode(data: `0x${string}`): boolean {
  return data.toLowerCase().endsWith(BUILDER_CODE_HEX);
}
