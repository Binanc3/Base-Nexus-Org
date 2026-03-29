import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

// Base Builder Code (ERC-8021)
// Get yours at: https://base.org/builders
export const BASE_BUILDER_CODE = (import.meta.env.VITE_BASE_BUILDER_CODE || '0x0762000000000000000000000000000000000000000000000000000000008021') as `0x${string}`;

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({ 
      appName: 'BaseNexus',
      preference: 'all', // Support both Smart Wallet and EOA
    }),
    injected({
      target: 'metaMask',
    }),
    injected({
      target: 'rabby',
    }),
    injected({
      target: 'zerion',
    }),
  ],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || undefined),
  },
});
