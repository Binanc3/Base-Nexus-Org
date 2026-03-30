import { http, createConfig, fallback } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import farcasterConnector from '@farcaster/miniapp-wagmi-connector';
import { stringToHex, pad, isHex } from 'viem';

// Base Builder Code (ERC-8021) Helper
// Ensures the code is correctly formatted as a 32-byte hex string ending in 8021
export function formatBuilderCode(code: string): `0x${string}` {
  if (!code) return '0x0762000000000000000000000000000000000000000000000000000000008021';
  
  let hexCode: `0x${string}`;
  if (isHex(code)) {
    hexCode = code as `0x${string}`;
  } else if (/^\d+$/.test(code)) {
    // If it's a decimal string, convert to hex
    hexCode = `0x${BigInt(code).toString(16)}` as `0x${string}`;
  } else {
    // Otherwise treat as string
    hexCode = stringToHex(code);
  }
  
  // Base Builder Attribution format: 32 bytes ending in 0x8021
  // Pad to 30 bytes and append 8021
  const padded = pad(hexCode, { size: 30, dir: 'right' });
  return `${padded.slice(0, 62)}8021` as `0x${string}`;
}

export const BASE_BUILDER_CODE = formatBuilderCode(import.meta.env.VITE_BASE_BUILDER_CODE || '');

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({ 
      appName: 'BaseNexus',
      preference: 'smartWalletOnly',
    }),
    farcasterConnector(),
    injected(),
  ],
  transports: {
    [base.id]: fallback([
      http(import.meta.env.VITE_BASE_RPC_URL || undefined),
      http('https://mainnet.base.org'),
      http('https://base.llamarpc.com'),
    ]),
  },
});
