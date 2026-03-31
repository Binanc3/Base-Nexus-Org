import { http, createConfig, fallback } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import farcasterConnector from '@farcaster/miniapp-wagmi-connector';
import { stringToHex, pad, isHex } from 'viem';

// Base Builder Code (ERC-8021) Helper
// Ensures the code is correctly formatted as an 8-byte hex string ending in 8021
export function formatBuilderCode(code: string): `0x${string}` {
  // Default to 1890 (0x0762) if no code provided, left-padded to 6 bytes before suffix
  if (!code) return '0x0000000007628021';
  
  let hexCode: `0x${string}`;
  let isNumeric = false;

  if (isHex(code)) {
    hexCode = code as `0x${string}`;
    isNumeric = true;
  } else if (/^\d+$/.test(code)) {
    // If it's a decimal string, convert to hex
    hexCode = `0x${BigInt(code).toString(16)}` as `0x${string}`;
    isNumeric = true;
  } else {
    // Otherwise treat as string
    // If string is longer than 6 chars, we truncate it to fit the 6-byte limit
    const truncated = code.substring(0, 6);
    hexCode = stringToHex(truncated);
    isNumeric = false;
  }
  
  // Base Builder Attribution format: 8 bytes total (16 hex characters) ending in 8021
  // The data part is 6 bytes, and the suffix is 2 bytes (8021)
  const padded = pad(hexCode, { size: 6, dir: isNumeric ? 'left' : 'right' });
  // padded is 0x + 12 hex chars (6 bytes)
  // We take the 6 bytes and append 8021 (2 bytes) for a total of 8 bytes
  const finalCode = `${padded}8021` as `0x${string}`;
  
  console.log(`[BaseNexus] Builder Code Formatted: ${finalCode} (Source: ${code})`);
  return finalCode;
}

/**
 * Appends the Base Builder Code (ERC-8021) to a hex data string.
 * Ensures the 0x prefix is handled correctly.
 */
export function appendBuilderCode(data: `0x${string}` | string): `0x${string}` {
  const cleanData = data.startsWith('0x') ? data : `0x${data}`;
  return `${cleanData}${BASE_BUILDER_CODE.slice(2)}` as `0x${string}`;
}

export const BASE_BUILDER_CODE = formatBuilderCode(import.meta.env.VITE_BASE_BUILDER_CODE || '');

// Dedicated EOA address for logging actions onchain.
// Sending data to a Smart Wallet (contract) address will revert, so we use a dead address for logging.
export const ONCHAIN_LOG_ADDRESS = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;

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
