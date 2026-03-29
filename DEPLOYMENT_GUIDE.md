# 🚀 BaseNexus Deployment & Configuration Guide

Welcome to the **BaseNexus** ecosystem! This guide contains everything you need to fully activate your dApp on the **Base Mainnet** with onchain attribution, real-time social features, and multi-wallet support.

---

## 1. 🛠️ Configuration & Environment Variables

You can configure the app in two ways:
1.  **Via Environment Variables (Recommended)**: Add these to **AI Studio Settings > Secrets** or your hosting provider's dashboard.
2.  **Directly in Code**: Modify the specific files mentioned below.

### 🔑 Required API Keys & Secrets
| Variable | Description | Where to get it | Where to input in code |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Powers the "Base AI" features | [Google AI Studio](https://aistudio.google.com/app/apikey) | **AI Studio Settings > Secrets** |
| `VITE_BASE_RPC_URL` | **(Recommended)** Your personal RPC for better performance | [Alchemy](https://www.alchemy.com/), [QuickNode](https://www.quicknode.com/), or [Infura](https://www.infura.io/) | `src/lib/wagmi.ts` (line 27) |
| `VITE_BASE_BUILDER_CODE` | Your unique onchain developer ID | [Base Builders Portal](https://base.org/builders) | `src/lib/wagmi.ts` (line 6) |

### 🌐 RPC Configuration
By default, the app uses a public RPC. For faster transactions and higher rate limits, we recommend using a personal RPC from Alchemy or QuickNode.
- **Variable Name**: `VITE_BASE_RPC_URL`
- **Example Value**: `https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY`

---

## 2. 🔥 Firebase Setup (Social & Leaderboards)

BaseNexus uses Firebase for the **Base Wall**, **Leaderboards**, and **AI Session Logs**.

1.  **Create a Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Firestore Database**:
    *   In the Firebase sidebar, go to **Build > Firestore Database**.
    *   Click **Create database** and select **Native Mode**.
    *   The app uses these collections:
        *   `messages`: Stores the real-time social feed for the **Base Wall**.
        *   `leaderboards`: Stores high scores from the **Game Hub**.
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
1.  **Bytecode**: Replace the placeholder bytecodes in `src/components/deployer/ContractDeployer.tsx` (lines 40-45) with actual compiled bytecode from OpenZeppelin (ERC-20/ERC-721).
2.  **Where to compile?**: Use [Remix IDE](https://remix.ethereum.org/) to compile your Solidity contracts and copy the `bytecode` from the "Compilation Details".

---

## 4. 🚀 Final Deployment Steps

1.  **Build**: Run `npm run build` to verify the production bundle.
2.  **Deploy**: Push to your preferred hosting provider (Vercel, Netlify, or Cloud Run).
3.  **BaseScan Verification**: Once live, your transactions will appear with your unique Builder Code. You can track your dApp's performance on the [Base Builder Leaderboard](https://base.org/builders).

---

**Need Help?** Check the [Base Developer Docs](https://docs.base.org) for more info on Builder Codes and Smart Wallet integration.
