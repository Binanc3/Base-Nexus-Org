# 🚀 BaseNexus Deployment & Configuration Guide

Welcome to the **BaseNexus** ecosystem! This guide contains everything you need to fully activate your dApp on the Base Mainnet with onchain attribution and real-time features.

---

## 1. 🛠️ Environment Variables (.env)
Set these variables in your environment (AI Studio Settings > Secrets):

```env
# Base Builder Code (ERC-8021) - Get yours at: https://base.org/builders
VITE_BASE_BUILDER_CODE=0xYOUR_HEX_CODE

# Firebase Configuration (Automatically handled if using set_up_firebase)
# If manual:
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## 2. 🔥 Firebase Setup
To enable the **Leaderboards** and **AI Session Logs**:

1.  **Firestore Database**:
    *   Create a Firestore database in **Native Mode**.
    *   Create a collection named `leaderboards`.
    *   Create a collection named `ai_sessions`.
2.  **Security Rules**:
    *   Deploy the `firestore.rules` provided in the codebase. These rules ensure that users can only write their own scores and read the top 10 rankings.
3.  **Authentication**:
    *   Enable **Google Login** in the Firebase Console (Build > Authentication > Sign-in method).

---

## 3. 🏗️ Contract Factory (Bytecode)
To make the **Contract Deployer** functional, you must provide the compiled bytecode for the contracts in `src/components/deployer/ContractDeployer.tsx`:

1.  **ERC-20**: Replace the placeholder `bytecode` (line 40) with the output from a compiler (like Remix or Hardhat) for an OpenZeppelin ERC20 contract.
2.  **ERC-721**: Similarly, provide the bytecode for an OpenZeppelin ERC721 contract.

---

## 4. 🔄 Swap Attribution (LI.FI)
The swap feature is currently attributed via the `integrator: "BaseNexus"` field in `src/components/swap/SwapSection.tsx`. 

*   **Why not the Hex Code?**: LI.FI is a cross-chain aggregator that uses its own internal attribution system (`integrator ID`) to track volume. This is the standard way to ensure your dApp gets credit within their routing contracts.
*   **Onchain Attribution**: All other features (Games, Check-ins, AI) use the **ERC-8021 Hex Code** suffix on every transaction, ensuring native Base ecosystem attribution.

---

## 5. 🎮 Game Leaderboards
The leaderboards are now configured to show the **Top 10** players. 
*   **How it works**: When a game ends, the score is saved to Firestore (for the UI) and logged onchain (for transparency).
*   **Verification**: You can see the onchain scores by checking the transaction data on BaseScan (it will look like `SCORE:GameID:Score` followed by your Builder Code).

---

## 6. 🚀 Final Deployment
1.  Run `npm run build` to ensure all TypeScript types are correct.
2.  Deploy to **Cloud Run** or your preferred host.
3.  **BaseScan Verification**: Once live, your transactions will start appearing with your unique Builder Code, contributing to your developer profile on Base.

---

**Need Help?** Check the [Base Developer Docs](https://docs.base.org) for more info on Builder Codes and Mainnet deployment.
