# 🚀 BaseNexus Deployment & Configuration Guide

Welcome to the **BaseNexus** ecosystem! This guide contains everything you need to fully activate your dApp on the **Base Mainnet** with onchain attribution, real-time social features, and multi-wallet support.

---

## 1. 🛠️ Configuration & Environment Variables

### AI Studio (Preview/Development)
The following are handled automatically or via the **Settings > Secrets** menu:
- **GEMINI_API_KEY**: Required for the "Base AI" features.
- **Firebase Config**: Automatically injected if you used the `set_up_firebase` tool.

### Production Deployment (Vercel, Cloud Run, etc.)
If deploying outside of AI Studio, ensure these variables are set:
```env
# Gemini AI API Key (from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key

# Base Builder Code (ERC-8021) - Get yours at: https://base.org/builders
# This is currently hardcoded in src/lib/wagmi.ts for convenience.
```

---

## 2. 🔥 Firebase Setup (Social & Leaderboards)

BaseNexus uses Firebase for the **Base Wall**, **Leaderboards**, and **AI Session Logs**.

1.  **Firestore Database**:
    *   Create a Firestore database in **Native Mode**.
    *   The app uses two main collections:
        *   `messages`: Stores the real-time social feed for the **Base Wall**.
        *   `leaderboards`: Stores high scores from the **Game Hub**.
2.  **Security Rules**:
    *   Deploy the `firestore.rules` provided in the codebase. These rules ensure that:
        *   Anyone can read messages and scores.
        *   Only authenticated users can post messages or log scores.
        *   Users cannot spoof their own `userAddress` or `uid`.
3.  **Authentication**:
    *   Enable **Google Login** in the Firebase Console (Build > Authentication > Sign-in method). This is required for posting to the Wall and logging scores.

---

## 3. 👛 Wallet Support (No IDs Required)

BaseNexus is optimized for the widest possible compatibility without requiring complex third-party project IDs:

*   **Base In-App Wallet (Smart Wallet):** Native support for the best Base experience.
*   **Browser Extensions:** Explicitly configured to detect **Rabby**, **Zerion**, and **MetaMask**.
*   **Injected Wallets:** Any EIP-1193 compatible wallet in your browser will be detected.
*   **Mainnet Only:** The app is hard-locked to **Base Mainnet (Chain ID: 8453)**. It will prompt users to switch networks if they are on a testnet or another chain.

---

## 4. 🏗️ Contract Factory (Bytecode)

To make the **Contract Deployer** functional for production:
1.  **Bytecode**: Replace the placeholder bytecodes in `src/components/deployer/ContractDeployer.tsx` with actual compiled bytecode from OpenZeppelin (ERC-20/ERC-721).
2.  **Verification**: Once a contract is deployed, users can view it on **BaseScan** using the provided links.

---

## 5. 🎮 Game Hub & Base Wall

*   **Onchain Logging**: When a user scores in a game or posts to the Wall, the app can log a 0 ETH transaction to self.
*   **Attribution**: Every transaction includes the **ERC-8021 Hex Code** suffix (`0x...8021`), ensuring your dApp contributes to the Base ecosystem's growth and your developer profile.
*   **Real-time Feed**: The Base Wall uses Firestore `onSnapshot` for instant updates across all users.

---

## 6. 🚀 Final Deployment Steps

1.  **Build**: Run `npm run build` to verify the production bundle.
2.  **Deploy**: Push to your preferred hosting provider.
3.  **BaseScan Verification**: Once live, your transactions will appear with your unique Builder Code. You can track your dApp's performance on the [Base Builder Leaderboard](https://base.org/builders).

---

**Need Help?** Check the [Base Developer Docs](https://docs.base.org) for more info on Builder Codes and Smart Wallet integration.
