import { http, createConfig } from 'wagmi';
import { base, mainnet, optimism, arbitrum, polygon } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { createPublicClient, stringToHex } from 'viem';

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
const BUILDER_CODE_HEX = (
  (import.meta.env.VITE_BUILDER_CODE as string | undefined) ?? 'ca11ba5e'
).replace(/^0x/i, '').toLowerCase();

export const BASE_BUILDER_CODE = BUILDER_CODE_HEX;

// ─── Onchain Log Address ─────────────────────────────────────
// NOTE: Ensure you deploy BaseNexusLogger.sol and add it to .env
export const ONCHAIN_LOG_ADDRESS = (
  (import.meta.env.VITE_ONCHAIN_LOG_ADDRESS as `0x${string}` | undefined)
  ?? '0x000000000000000000000000000000000000dEaD'
) as `0x${string}`;

// ─── appendBuilderCode ───────────────────────────────────────
export function appendBuilderCode(data: `0x${string}`): `0x${string}` {
  // FIX: Force the base string to always be a valid hex starting with '0x'
  let baseStr = data && data.length > 0 ? data : '0x';
  if (!baseStr.startsWith('0x')) {
    baseStr = `0x${baseStr}` as `0x${string}`;
  }

  if (
    !/^[0-9a-f]*$/.test(BUILDER_CODE_HEX) ||
    BUILDER_CODE_HEX.length % 2 !== 0
  ) {
    console.error(
      `[Builder] Invalid BUILDER_CODE: "${BUILDER_CODE_HEX}". ` +
      `Must be even-length hex without 0x prefix. Skipping append.`
    );
    return baseStr as `0x${string}`;
  }

  return `${baseStr}${BUILDER_CODE_HEX}` as `0x${string}`;
}

export function hasBuilderCode(data: `0x${string}`): boolean {
  const dataStr = data.toLowerCase();
  return dataStr.endsWith(BUILDER_CODE_HEX);
}

export function stripBuilderCode(data: `0x${string}`): `0x${string}` {
  if (hasBuilderCode(data)) {
    return data.slice(0, -BUILDER_CODE_HEX.length) as `0x${string}`;
  }
  return data;
}

export function createLogData(message: string): `0x${string}` {
  const hex = stringToHex(message);
  return appendBuilderCode(hex);
}
