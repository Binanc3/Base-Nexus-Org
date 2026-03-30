import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { config } from '../lib/wagmi';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';
import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

function App() {
  // ← THIS LOG SHOULD ALWAYS APPEAR if the app is running
  console.log("🚀 App component has mounted!");

  useEffect(() => {
    const markReady = async () => {
      try {
        console.log("📡 Sending ready signal to Farcaster...");
        await sdk.actions.ready();
        console.log("✅ Mini app is now READY (splash screen hidden)");
      } catch (err) {
        console.error("❌ Ready signal failed:", err);
      }
    };

    markReady();
  }, []);

  // ... your existing return (UI) code here
  return (
    // your app content
  );
}

export default App;

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
