import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

// Base Builder Code (ERC-8021)
// Replace with your actual code from base.dev
export const BASE_BUILDER_CODE = '0x0762000000000000000000000000000000000000000000000000000000008021';

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({ 
      appName: 'BaseNexus',
      preference: 'smartWalletOnly'
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});
