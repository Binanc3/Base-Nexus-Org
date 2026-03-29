import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

// Base Builder Code (ERC-8021)
export const BASE_BUILDER_CODE = '0x0762000000000000000000000000000000000000000000000000000000008021';

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
    [base.id]: http(),
  },
});
