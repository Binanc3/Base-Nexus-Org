# 🚀 BaseNexus Deployment & Configuration Guide

Welcome to the **BaseNexus** ecosystem! This guide contains everything you need to fully activate your dApp on the **Base Mainnet** with onchain attribution, real-time social features, and multi-wallet support.

---

## ✅ Pre-Deployment Checklist

Before you deploy to production, ensure you have completed these steps:

1.  [ ] **Google AI Studio Key**: Get your key from [aistudio.google.com](https://aistudio.google.com/app/apikey).
2.  [ ] **Base Builder Code**: Get your unique code from [base.org/builders](https://base.org/builders).
3.  [ ] **Personal RPC (Optional but Recommended)**: Get a Base Mainnet RPC from [Alchemy](https://www.alchemy.com/) or [QuickNode](https://www.quicknode.com/).
4.  [ ] **Firebase Project**: Set up a project at [console.firebase.google.com](https://console.firebase.google.com/).
    *   *Note: If you encounter a "billing required" error, you must link a billing account to your Google Cloud project.*
5.  [ ] **Contract Bytecode**: Compile your ERC-20/ERC-721 contracts in [Remix IDE](https://remix.ethereum.org/) and update the code.

---

## 1. 🛠️ Configuration & Environment Variables

You can configure the app by adding these to **AI Studio Settings > Secrets** (for the preview) or your hosting provider's dashboard (for production).

### 🔑 Required API Keys & Secrets
| Variable | Description | Where to get it |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Powers the "Base AI" features | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VITE_BASE_RPC_URL` | **(Recommended)** Your personal RPC for better performance | [Alchemy](https://www.alchemy.com/) or [QuickNode](https://www.quicknode.com/) |
| `VITE_BASE_BUILDER_CODE` | Your unique onchain developer ID | [Base Builders Portal](https://base.org/builders) |

### 🌐 How to input in code
If you prefer not to use environment variables, you can modify these files directly:
- **Builder Code & RPC**: `src/lib/wagmi.ts`
- **AI Key**: `src/components/ai/OnchainAI.tsx`

---

## 2. 🔥 Firebase Setup (Social & Leaderboards)

BaseNexus uses Firebase for the **Base Wall**, **Leaderboards**, and **AI Session Logs**.

1.  **Create a Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Firestore Database**:
    *   In the Firebase sidebar, go to **Build > Firestore Database**.
    *   Click **Create database** and select **Native Mode**.
    *   **Collections**: The app automatically creates `messages` and `leaderboards` when data is first saved.
3.  **Security Rules**:
    *   Go to the **Rules** tab in Firestore.
    *   Copy and paste the contents of `firestore.rules` from this project.
4.  **Authentication**:
    *   Go to **Build > Authentication > Sign-in method**.
    *   Enable **Google** as a provider. This is required for users to post to the Wall and log scores.
5.  **Config File**:
    *   Download your `firebase-applet-config.json` from the Firebase Console and replace the one in your project root.

---

## 3. 🏗️ Contract Factory (Bytecode)

To make the **Contract Deployer** functional for production:
1.  **Compile**: Open your Solidity contract in [Remix IDE](https://remix.ethereum.org/).
2.  **Copy Bytecode**: In the "Solidity Compiler" tab, click "Compilation Details" and copy the `bytecode` object.
3.  **Update Code**: Replace the placeholder bytecodes in `src/components/deployer/ContractDeployer.tsx` with your actual compiled bytecode.

---

## 4. 🚀 Final Deployment Steps

1.  **Build**: Run `npm run build` to verify the production bundle.
2.  **Deploy**: Push to your preferred hosting provider (Vercel, Netlify, or Cloud Run).
3.  **BaseScan Verification**: Once live, your transactions will appear with your unique Builder Code. You can track your dApp's performance on the [Base Builder Leaderboard](https://base.org/builders).

---

**Need Help?** Check the [Base Developer Docs](https://docs.base.org) for more info on Builder Codes and Smart Wallet integration.
