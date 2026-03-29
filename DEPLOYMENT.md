# BaseNexus Deployment Guide

Follow these steps to deploy BaseNexus to production on the Base Mainnet.

## 1. Environment Variables
Create a `.env` file in your production environment (e.g., Vercel) with the following:

```env
# Gemini AI API Key (from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key

# WalletConnect Project ID (from cloud.walletconnect.com)
VITE_WALLETCONNECT_PROJECT_ID=your_project_id

# LI.FI API Key (Optional, for higher rate limits)
VITE_LIFI_API_KEY=your_lifi_key

# Base RPC URL (Optional, defaults to public)
VITE_BASE_RPC_URL=https://mainnet.base.org
```

## 2. Base Builder Code (ERC-8021)
1. Visit [base.dev](https://base.dev) and register your application.
2. Obtain your unique **Builder Code**.
3. Update the `BASE_BUILDER_CODE` constant in `src/lib/wagmi.ts`.
4. Ensure all `wallet.sendCalls` implementations include the `dataSuffix` with this code.

## 3. Frontend Deployment (Vercel)
1. Push your code to a GitHub repository.
2. Connect the repository to Vercel.
3. Set the Framework Preset to **Vite**.
4. Add the environment variables listed in Step 1.
5. Deploy.

## 4. Mainnet Testing
1. Connect a Coinbase Smart Wallet or any EIP-5792 compatible wallet.
2. Perform a "GM" check-in to verify onchain transaction logic.
3. Test a small swap via the Swap section to verify LI.FI routing.
4. Verify transaction attribution on the Base Builder leaderboard.

## 6. Deploying as a "Mini App" (Coinbase Wallet / Farcaster)

To integrate BaseNexus as a mini-app within the Base ecosystem:

### Coinbase Wallet Mini App
1. **PWA Optimization**: The app is already configured with a `manifest.json` and mobile-responsive navigation.
2. **Smart Wallet**: The `wagmi` config is set to `smartWalletOnly`, which provides the best experience for Coinbase Wallet users.
3. **Submission**: Once hosted on Vercel, you can submit your URL to the [Coinbase Wallet Developer Portal](https://www.coinbase.com/wallet/developers) to be featured in the in-app browser.

### Farcaster Frames v2
1. **Frame Metadata**: To turn this into a Farcaster Frame v2 (which acts as a mini-app), you need to add the Farcaster SDK and specific meta tags.
2. **Optimization**: Ensure your Vercel URL is verified on your Farcaster profile.

### Deep Linking
Use the following format to open your app directly in the Coinbase Wallet browser:
`https://go.cb-w.com/dapp?cb_url=https://your-vercel-url.vercel.app`
