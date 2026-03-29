# 🚀 BaseNexus Deployment & Configuration Guide

Welcome to the **BaseNexus** ecosystem! This guide contains everything you need to fully activate your dApp on the **Base Mainnet**.

---

## ✅ Your Action Items (To-Do)

Since I have already handled the **Firebase Setup** for you, here is exactly what is left for you to do:

### 1. 🔑 API Keys & Secrets (Required)
Add these to **AI Studio Settings > Secrets** (click the gear icon in the top right).

| Variable | Description | Where to get it |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Powers the "Base AI" features | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VITE_BASE_BUILDER_CODE` | Your unique onchain developer ID | [Base Builders Portal](https://base.org/builders) |
| `VITE_BASE_RPC_URL` | *Optional* - Your personal Base RPC | [Alchemy](https://www.alchemy.com/) or [QuickNode](https://www.quicknode.com/) |

---

### 2. 🏗️ Contract Factory (Bytecode)
To make the **Contract Deployer** functional, you must replace the placeholder bytecodes in the source code.

**File to Edit**: `src/components/deployer/ContractDeployer.tsx`

*   **ERC-20 Bytecode**: Replace the string at **Line 11** (`const ERC20_BYTECODE = '...'`).
*   **ERC-721 Bytecode**: Replace the string at **Line 14** (`const ERC721_BYTECODE = '...'`).

**How to get the bytecode?**
1.  Open [Remix IDE](https://remix.ethereum.org/).
2.  Create or open your Solidity contract (e.g., an OpenZeppelin ERC-20).
3.  Go to the **Solidity Compiler** tab and click **Compile**.
4.  Click **Compilation Details** at the bottom of the sidebar.
5.  Find the **Bytecode** section and copy the `object` value (it starts with `0x`).

---

## 🔥 Firebase (Socials & Leaderboards) - ✅ COMPLETED

I have already provisioned and configured Firebase for this project. You do **not** need to perform any manual setup for:
*   **Base Wall** (Social Feed)
*   **Game Hub** (Leaderboards)
*   **Authentication** (Google Login)

*Note: If you ever decide to move this app to your own hosting (like Vercel), you will need to create your own Firebase project and update the `firebase-applet-config.json`.*

---

## 🚀 Final Deployment Steps (Vercel)

If you are deploying to **Vercel**, follow these steps:

1.  **Import Project**: Connect your GitHub repository to Vercel.
2.  **Environment Variables**: In the Vercel dashboard, go to **Settings > Environment Variables** and add:
    *   `GEMINI_API_KEY`
    *   `VITE_BASE_BUILDER_CODE`
    *   `VITE_BASE_RPC_URL` (Optional)
3.  **Build Settings**: Vercel should automatically detect the Vite build settings (`npm run build` and `dist` directory).
4.  **Deploy**: Click **Deploy**.

---

**Note on AI Studio Settings**: 
*   **AI Studio Secrets**: These are only for the **preview** you see here in the editor. Add them if you want to test the AI and onchain features before you deploy.
*   **Vercel Environment Variables**: These are for your **live website**. You **must** add them in the Vercel dashboard for the deployed app to work.
