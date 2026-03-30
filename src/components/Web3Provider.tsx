import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { config } from '../lib/wagmi';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

function App() {
  // ← THIS LOG SHOULD ALWAYS APPEAR if the app is running
  console.log("🚀 App component has mounted!");

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
          chain={base}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
