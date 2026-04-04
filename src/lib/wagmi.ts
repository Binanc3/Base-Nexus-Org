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
 * PROPERLY concatenates without creating malformed data.
 */
export function appendBuilderCode(data: `0x${string}` | string): `0x${string}` {
  try {
    // Ensure data starts with 0x
    const cleanData = data.startsWith('0x') ? (data as `0x${string}`) : (`0x${data}` as `0x${string}`);
    
    // Use proper concatenation
    const builderCode = BASE_BUILDER_CODE.slice(2); // Remove 0x prefix
    const result = `${cleanData}${builderCode}` as `0x${string}`;
    
    console.log(`[BaseNexus] Data with builder code: ${result}`);
    return result;
  } catch (error) {
    console.error('[BaseNexus] Failed to append builder code:', error);
    // Fallback: return just the builder code if data is malformed
    return BASE_BUILDER_CODE;
  }
}

/**
 * Creates proper log transaction data with builder code
 * This creates a valid transaction that logs data onchain
 */
export function createLogData(message: string): `0x${string}` {
  try {
    const messageHex = stringToHex(message);
    return appendBuilderCode(messageHex);
  } catch (error) {
    console.error('[BaseNexus] Failed to create log data:', error);
    return appendBuilderCode('0x');
  }
}

export const BASE_BUILDER_CODE = formatBuilderCode(import.meta.env.VITE_BASE_BUILDER_CODE || '');

/**
 * FIXED: Using zero address instead of dead address for logging
 * Sending to zero address allows data to be logged without contract execution
 */
export const ONCHAIN_LOG_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

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
