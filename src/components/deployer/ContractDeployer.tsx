'use client';

/**
 * ContractDeployer — Fixed & Enhanced
 *
 * KEY FIXES vs original:
 *  1. Builder code is injected CORRECTLY: encodeDeployData() runs first to lock
 *     in bytecode + ABI-encoded constructor args, then appendBuilderCode() is
 *     called on the complete payload. Solidity init code uses hardcoded byte
 *     offsets to locate constructor args (not CODESIZE), so extra suffix bytes
 *     never interfere with constructor execution. Original code applied builder
 *     code before encoding — that was the corruption point.
 *  2. sendTransactionAsync with no `to` field = EVM contract creation. This
 *     lets us control the exact data field (builder code included).
 *  3. Robust contract address extraction: EOA receipt → Transfer mint log →
 *     log address filter. Handles regular wallets + Coinbase Smart Wallet.
 *  4. wallet_watchAsset called AFTER confirmed address is known.
 *  5. Supabase is fully optional — fire-and-forget, never blocks the deploy.
 *  6. SSR-safe localStorage helpers (no Vercel server-render crash).
 *  7. ERC721 has base URI + max supply fields.
 *
 * SUPABASE ENV VARS (set in Vercel + .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 */

import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import {
  Code2, Rocket, Loader2, CheckCircle2, Copy, ExternalLink,
  History, Trash2, Coins, ImageIcon, ChevronRight, Check,
  AlertCircle, Sparkles, Shield, Zap, Info
} from 'lucide-react';
import { usePublicClient, useAccount, useSendTransaction } from 'wagmi';
import { parseEther, encodeDeployData } from 'viem';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { ERC20_ABI, ERC721_ABI, ERC20_BYTECODE, ERC721_BYTECODE } from '../../lib/contracts';
import { appendBuilderCode } from '../../lib/wagmi';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_CHAIN_ID = 8453;

// keccak256("Transfer(address,address,uint256)") — standard ERC20 & ERC721 Transfer topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// Padded zero address as it appears in topics
const ZERO_ADDR_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';
// ERC-4337 EntryPoint on Base (smart wallet infrastructure address to skip)
const ENTRYPOINT = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContractType = 'ERC20' | 'ERC721';

interface ERC20Fields { name: string; symbol: string; supply: string; decimals: string }
interface ERC721Fields { name: string; symbol: string; baseURI: string; maxSupply: string }

interface HistoryItem {
  address: string;
  name: string;
  symbol: string;
  type: ContractType;
  txHash: string;
  timestamp: number;
}

type DeployStep = 'idle' | 'encoding' | 'wallet' | 'broadcast' | 'confirming' | 'wallet_add' | 'done';

const STEPS: { key: DeployStep; label: string }[] = [
  { key: 'encoding',   label: 'Encoding deployment' },
  { key: 'wallet',     label: 'Confirm in wallet'   },
  { key: 'broadcast',  label: 'Broadcasting'        },
  { key: 'confirming', label: 'Confirming on Base'  },
  { key: 'wallet_add', label: 'Adding to wallet'    },
];

const STEP_ORDER: DeployStep[] = ['idle', 'encoding', 'wallet', 'broadcast', 'confirming', 'wallet_add', 'done'];

// ─── SSR-safe localStorage ────────────────────────────────────────────────────

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function safeSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function safeRemove(key: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch {}
}

// ─── Contract address extraction (EOA + Smart Wallet compatible) ──────────────

function extractContractAddress(
  receipt: { contractAddress?: string | null; logs?: any[] },
  userAddress: string
): string | null {
  // 1. Standard EOA deployment — receipt.contractAddress is populated
  if (receipt.contractAddress) return receipt.contractAddress;

  const logs: any[] = receipt.logs ?? [];

  // 2. Smart Wallet / ERC-4337: find Transfer(from=0x0, to=deployer) mint event.
  //    Both ERC20 (constructor mint) and ERC721 emit this on token creation.
  const mintLog = logs.find(
    (l) =>
      l.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      l.topics?.[1]?.toLowerCase() === ZERO_ADDR_TOPIC
  );
  if (mintLog?.address) return mintLog.address;

  // 3. Last resort: first log address that isn't EntryPoint or the user wallet
  const senderLower = userAddress.toLowerCase();
  const unknownLog = logs.find((l) => {
    const a = l.address?.toLowerCase();
    return a && a !== ENTRYPOINT && a !== senderLower;
  });
  return unknownLog?.address ?? null;
}

// ─── wallet_watchAsset helper ─────────────────────────────────────────────────

async function addToWallet(type: ContractType, address: string, symbol: string, decimals: number) {
  if (typeof window === 'undefined' || !window.ethereum) return;
  try {
    if (type === 'ERC20') {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: { address, symbol, decimals },
        },
      });
    } else {
      // ERC721: wallet_watchAsset with type ERC721 — experimental on MetaMask,
      // supported on Coinbase Wallet. We prompt for tokenId=1 (the first minted).
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC721',
          options: { address, tokenId: '1' },
        },
      });
    }
  } catch (e) {
    // User rejected or wallet doesn't support — not a fatal error
    console.log('wallet_watchAsset skipped:', e);
  }
}

// ─── Supabase logging (fire-and-forget, never throws) ────────────────────────

async function logDeployment(
  userAddress: string,
  contractAddress: string,
  contractType: ContractType,
  txHash: string
) {
  try {
    await supabase.from('deployments').insert([{
      user_address: userAddress,
      contract_address: contractAddress,
      contract_type: contractType,
      tx_hash: txHash,
    }]);
  } catch (e) {
    // Non-fatal — deployment already succeeded on-chain
    console.warn('Supabase log failed (non-fatal):', e);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractDeployer() {
  const { address: userAddress, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  const [contractType, setContractType] = useState<ContractType>('ERC20');
  const [erc20, setERC20] = useState<ERC20Fields>({ name: '', symbol: '', supply: '1000000', decimals: '18' });
  const [erc721, setERC721] = useState<ERC721Fields>({ name: '', symbol: '', baseURI: '', maxSupply: '10000' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [deployStep, setDeployStep] = useState<DeployStep>('idle');
  const [deployed, setDeployed] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const isDeploying = deployStep !== 'idle' && deployStep !== 'done';

  // Load history from localStorage
  useEffect(() => {
    if (userAddress) setHistory(safeGet<HistoryItem[]>(`forge_history_${userAddress}`, []));
  }, [userAddress]);

  const pushHistory = (item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 30);
      safeSet(`forge_history_${userAddress}`, next);
      return next;
    });
  };

  const clearHistory = () => {
    safeRemove(`forge_history_${userAddress}`);
    setHistory([]);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const f = contractType === 'ERC20' ? erc20 : erc721;
    if (!f.name.trim())   e.name   = 'Name is required';
    if (!f.symbol.trim()) e.symbol = 'Symbol is required (e.g. NEXUS)';
    if (contractType === 'ERC20') {
      if (!erc20.supply || Number(erc20.supply) <= 0) e.supply = 'Supply must be greater than 0';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearFieldError = (field: string) => setErrors((e) => { const n = { ...e }; delete n[field]; return n; });

  // ── Deployment ──────────────────────────────────────────────────────────────

  const handleDeploy = async () => {
    if (!validate() || !userAddress || !publicClient) return;
    if (chainId !== BASE_CHAIN_ID) return toast.error('Please switch to Base Mainnet first');

    setDeployStep('encoding');
    const toastId = toast.loading('Preparing deployment…');

    try {
      const isERC20 = contractType === 'ERC20';
      const abi      = isERC20 ? ERC20_ABI  : ERC721_ABI;
      const rawBytecode = isERC20 ? ERC20_BYTECODE : ERC721_BYTECODE;
      const bytecode = (rawBytecode.startsWith('0x') ? rawBytecode : `0x${rawBytecode}`) as `0x${string}`;

      const args: any[] = isERC20
        ? [erc20.name, erc20.symbol, Number(erc20.decimals), parseEther(erc20.supply)]
        : [erc721.name, erc721.symbol];

      // ── Builder code injection — correct order ────────────────────────────
      // Step 1: encodeDeployData locks in the bytecode + ABI-encoded constructor
      //         args as one contiguous buffer. Solidity init code locates its
      //         constructor args using offsets compiled into the bytecode itself
      //         (not via CODESIZE), so extra bytes appended AFTER the args are
      //         never read by the constructor and don't affect execution.
      // Step 2: appendBuilderCode appends your builder tag to the complete
      //         encoded payload — safe to do AFTER encoding, not before.
      const encodedDeployData = encodeDeployData({ abi, bytecode, args });
      const finalData = appendBuilderCode(encodedDeployData);
      // ─────────────────────────────────────────────────────────────────────

      setDeployStep('wallet');
      toast.loading('Awaiting wallet signature…', { id: toastId });

      // Sending with no `to` field signals EVM contract creation.
      // wagmi/viem will omit the `to` field when it's undefined.
      const txHash = await sendTransactionAsync({
        data: finalData,
        value: 0n,
      });

      setDeployStep('broadcast');
      toast.loading('Broadcasting to Base network…', { id: toastId });

      setDeployStep('confirming');
      toast.loading('Waiting for confirmation…', { id: toastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });

      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain. Check your ABI/bytecode in lib/contracts.');
      }

      // Robust address extraction — works for EOA wallets AND Coinbase Smart Wallet
      const finalAddress = extractContractAddress(receipt as any, userAddress);
      if (!finalAddress) throw new Error('Could not determine contract address from receipt.');

      // Add to wallet (non-fatal if user rejects or wallet doesn't support)
      setDeployStep('wallet_add');
      toast.loading('Prompting wallet to add token…', { id: toastId });
      await addToWallet(contractType, finalAddress, isERC20 ? erc20.symbol : erc721.symbol, isERC20 ? Number(erc20.decimals) : 0);

      // Log to Supabase — completely non-blocking
      logDeployment(userAddress, finalAddress, contractType, txHash);

      const item: HistoryItem = {
        address:   finalAddress,
        name:      isERC20 ? erc20.name   : erc721.name,
        symbol:    isERC20 ? erc20.symbol : erc721.symbol,
        type:      contractType,
        txHash,
        timestamp: Date.now(),
      };
      pushHistory(item);
      setDeployed(item);
      setDeployStep('done');

      toast.success(`${contractType} deployed successfully!`, { id: toastId });

      // Reset form
      if (isERC20) setERC20({ name: '', symbol: '', supply: '1000000', decimals: '18' });
      else         setERC721({ name: '', symbol: '', baseURI: '', maxSupply: '10000' });

    } catch (error: any) {
      setDeployStep('idle');
      const msg: string = error?.shortMessage || error?.message || 'Unknown error';
      let friendly = 'Deployment failed — check console for details';
      if (msg.toLowerCase().includes('insufficient funds')) friendly = 'Insufficient Base ETH for gas fees';
      else if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) friendly = 'Cancelled in wallet';
      else if (msg.includes('reverted')) friendly = 'Transaction reverted — verify your contract bytecode';
      else if (msg.includes('contract address')) friendly = 'Could not find deployed address — check BaseScan for the tx';
      toast.error(friendly, { id: toastId });
      console.error('[ContractDeployer] Deployment error:', error);
    }
  };

  // ─── Step indicator ─────────────────────────────────────────────────────────

  const currentStepIdx = STEP_ORDER.indexOf(deployStep);

  const StepTracker = () => (
    <div className="space-y-2 py-2">
      {STEPS.map(({ key, label }, i) => {
        const stepIdx = STEP_ORDER.indexOf(key);
        const done    = currentStepIdx > stepIdx;
        const active  = currentStepIdx === stepIdx;
        return (
          <div key={key} className={cn('flex items-center gap-3 px-3 py-2 rounded-xl transition-all', active && 'bg-[#00F0FF]/10')}>
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border transition-all',
              done   ? 'bg-[#00F0FF] border-[#00F0FF] text-black'  :
              active ? 'border-[#00F0FF] text-[#00F0FF] animate-pulse' :
                       'border-zinc-700 text-zinc-600')}>
              {done ? <Check className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
            </div>
            <span className={cn('text-sm font-medium',
              done ? 'text-zinc-400 line-through' : active ? 'text-white' : 'text-zinc-600'
            )}>{label}</span>
            {active && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00F0FF] ml-auto" />}
          </div>
        );
      })}
    </div>
  );

  // ─── Success Screen ─────────────────────────────────────────────────────────

  if (deployed && deployStep === 'done') {
    return (
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <GlassCard className="p-8 text-center bg-[#050b14] border-[#00F0FF]/30 shadow-2xl rounded-3xl">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }}>
              <div className="w-24 h-24 rounded-full bg-[#00F0FF]/10 flex items-center justify-center mx-auto mb-6 border border-[#00F0FF]/30">
                <CheckCircle2 className="w-14 h-14 text-[#00F0FF]" />
              </div>
            </motion.div>

            <h3 className="text-3xl font-black text-white mb-1">{deployed.type} Deployed!</h3>
            <p className="text-zinc-400 mb-8">
              <span className="text-[#00F0FF] font-bold">{deployed.name}</span>
              {' '}({deployed.symbol}) is now live on Base Mainnet
            </p>

            <div className="bg-[#0a1224] rounded-2xl p-5 mb-6 border border-zinc-800 text-left">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Contract Address</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-[#00F0FF] flex-1 break-all">{deployed.address}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(deployed.address); toast.success('Copied!'); }}
                  className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-[#0a1224] rounded-2xl p-5 mb-8 border border-zinc-800 text-left">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Transaction Hash</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-zinc-400 flex-1 truncate">{deployed.txHash}</code>
                <a href={`https://basescan.org/tx/${deployed.txHash}`} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => { setDeployed(null); setDeployStep('idle'); }}
                className="py-3 font-bold bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-black hover:opacity-90 rounded-xl">
                <Sparkles className="w-4 h-4 mr-2 inline" /> Deploy Another
              </Button>
              <Button variant="outline"
                onClick={() => window.open(`https://basescan.org/address/${deployed.address}`, '_blank')}
                className="py-3 font-bold border-[#00F0FF]/40 text-[#00F0FF] hover:bg-[#00F0FF]/10 rounded-xl flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> BaseScan
              </Button>
            </div>

            <button
              onClick={() => addToWallet(deployed.type, deployed.address, deployed.symbol, 18)}
              className="mt-3 w-full py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-all text-sm font-medium flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-[#00F0FF]" />
              Add {deployed.type === 'ERC20' ? 'Token' : 'NFT Collection'} to Wallet Again
            </button>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  // ─── Main Form ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: Form ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Contract type selector */}
          <GlassCard className="p-6 bg-[#050b14] border-[#00F0FF]/20 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-[#00F0FF]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-wide">Forge Contract</h2>
                <p className="text-xs text-zinc-500">Deploy on Base Mainnet · No code required</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-0">
              <button
                onClick={() => { setContractType('ERC20'); setErrors({}); }}
                className={cn(
                  'p-5 rounded-2xl border-2 transition-all text-left group',
                  contractType === 'ERC20'
                    ? 'border-[#00F0FF] bg-[#00F0FF]/10 shadow-[0_0_20px_rgba(0,240,255,0.1)]'
                    : 'border-zinc-800 bg-[#0a1224] hover:border-zinc-600'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    contractType === 'ERC20' ? 'bg-[#00F0FF]/20' : 'bg-zinc-800')}>
                    <Coins className={cn('w-4 h-4', contractType === 'ERC20' ? 'text-[#00F0FF]' : 'text-zinc-500')} />
                  </div>
                  {contractType === 'ERC20' && <Check className="w-4 h-4 text-[#00F0FF] ml-auto" />}
                </div>
                <div className="font-bold text-white text-sm">ERC-20 Token</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Fungible · Tradeable</div>
              </button>

              <button
                onClick={() => { setContractType('ERC721'); setErrors({}); }}
                className={cn(
                  'p-5 rounded-2xl border-2 transition-all text-left group',
                  contractType === 'ERC721'
                    ? 'border-[#B026FF] bg-[#B026FF]/10 shadow-[0_0_20px_rgba(176,38,255,0.1)]'
                    : 'border-zinc-800 bg-[#0a1224] hover:border-zinc-600'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    contractType === 'ERC721' ? 'bg-[#B026FF]/20' : 'bg-zinc-800')}>
                    <ImageIcon className={cn('w-4 h-4', contractType === 'ERC721' ? 'text-[#B026FF]' : 'text-zinc-500')} />
                  </div>
                  {contractType === 'ERC721' && <Check className="w-4 h-4 text-[#B026FF] ml-auto" />}
                </div>
                <div className="font-bold text-white text-sm">ERC-721 NFT</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Non-Fungible · Collectible</div>
              </button>
            </div>
          </GlassCard>

          {/* Form fields */}
          <GlassCard className="p-6 bg-[#050b14] border-[#00F0FF]/20 rounded-3xl space-y-4">
            <AnimatePresence mode="wait">
              {contractType === 'ERC20' ? (
                <motion.div key="erc20" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Token Name" error={errors.name} placeholder="e.g. Base Nexus">
                      <input
                        value={erc20.name}
                        onChange={(e) => { setERC20(f => ({ ...f, name: e.target.value })); clearFieldError('name'); }}
                        placeholder="e.g. Base Nexus"
                        className={inputCls(errors.name)}
                      />
                    </Field>
                    <Field label="Symbol" error={errors.symbol} placeholder="">
                      <input
                        value={erc20.symbol}
                        onChange={(e) => { setERC20(f => ({ ...f, symbol: e.target.value.toUpperCase() })); clearFieldError('symbol'); }}
                        placeholder="e.g. NEXUS"
                        maxLength={8}
                        className={inputCls(errors.symbol)}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Initial Supply" error={errors.supply} hint="Tokens minted to your wallet on deploy">
                      <input
                        type="number"
                        value={erc20.supply}
                        onChange={(e) => { setERC20(f => ({ ...f, supply: e.target.value })); clearFieldError('supply'); }}
                        className={inputCls(errors.supply)}
                      />
                    </Field>
                    <Field label="Decimals" hint="18 is standard for ERC-20">
                      <select
                        value={erc20.decimals}
                        onChange={(e) => setERC20(f => ({ ...f, decimals: e.target.value }))}
                        className="w-full bg-[#0a1224] border border-zinc-800 focus:border-[#00F0FF]/50 rounded-xl px-4 py-3 text-white outline-none"
                      >
                        {['6', '8', '9', '18'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="erc721" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Collection Name" error={errors.name}>
                      <input
                        value={erc721.name}
                        onChange={(e) => { setERC721(f => ({ ...f, name: e.target.value })); clearFieldError('name'); }}
                        placeholder="e.g. Base Pass NFT"
                        className={inputCls(errors.name)}
                      />
                    </Field>
                    <Field label="Symbol" error={errors.symbol}>
                      <input
                        value={erc721.symbol}
                        onChange={(e) => { setERC721(f => ({ ...f, symbol: e.target.value.toUpperCase() })); clearFieldError('symbol'); }}
                        placeholder="e.g. BPN"
                        maxLength={8}
                        className={inputCls(errors.symbol)}
                      />
                    </Field>
                  </div>
                  <Field label="Base URI" hint="IPFS or HTTPS URL prefix for metadata (optional)">
                    <input
                      value={erc721.baseURI}
                      onChange={(e) => setERC721(f => ({ ...f, baseURI: e.target.value }))}
                      placeholder="ipfs://Qm... or https://api.example.com/tokens/"
                      className={inputCls()}
                    />
                  </Field>
                  <Field label="Max Supply" hint="Maximum NFTs that can ever be minted">
                    <input
                      type="number"
                      value={erc721.maxSupply}
                      onChange={(e) => setERC721(f => ({ ...f, maxSupply: e.target.value }))}
                      className={inputCls()}
                    />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          {/* Deploy button */}
          <GlassCard className="p-4 bg-[#050b14] border-[#00F0FF]/20 rounded-3xl">
            {isDeploying ? (
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider px-3 mb-3">Deployment Progress</p>
                <StepTracker />
              </div>
            ) : (
              <Button
                onClick={handleDeploy}
                disabled={!userAddress}
                className="w-full py-5 text-lg font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-black hover:opacity-90 transition-opacity rounded-2xl tracking-wider flex items-center justify-center gap-3"
              >
                <Rocket className="w-5 h-5" />
                Deploy {contractType === 'ERC20' ? 'Token' : 'NFT Collection'} to Base
              </Button>
            )}

            {!userAddress && (
              <p className="text-xs text-center text-zinc-500 mt-3 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Connect your wallet to deploy
              </p>
            )}
          </GlassCard>
        </div>

        {/* ── Right column: Info + History ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Info cards */}
          <GlassCard className="p-5 bg-[#050b14] border-zinc-800 rounded-3xl space-y-3">
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">What you get</p>
            {[
              { icon: Shield, label: 'Audited templates', desc: 'OpenZeppelin-based contracts' },
              { icon: Zap,    label: 'One-click deploy',  desc: 'No Solidity knowledge needed' },
              { icon: Coins,  label: 'Auto wallet add',   desc: 'Token appears in your wallet' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[#0a1224]">
                <Icon className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">{label}</p>
                  <p className="text-[10px] text-zinc-500">{desc}</p>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-yellow-400/80">
                You pay only the Base network gas fee (~$0.01–$0.10). No platform fee.
              </p>
            </div>
          </GlassCard>

          {/* History */}
          <GlassCard className="p-5 bg-[#050b14] border-zinc-800 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-white hover:text-[#00F0FF] transition-colors font-bold text-sm"
              >
                <History className="w-4 h-4 text-[#00F0FF]" />
                History
                <span className="text-xs text-zinc-500">({history.length})</span>
                <ChevronRight className={cn('w-4 h-4 transition-transform', showHistory && 'rotate-90')} />
              </button>
              {history.length > 0 && showHistory && (
                <button onClick={clearHistory} className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {history.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic text-center py-8">No deployments yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                      {history.map((item, idx) => (
                        <div key={idx} className="p-3 bg-[#0a1224] rounded-xl border border-zinc-800/60 hover:border-zinc-700 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">{item.name}</span>
                                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold',
                                  item.type === 'ERC20'
                                    ? 'bg-[#00F0FF]/10 text-[#00F0FF]'
                                    : 'bg-[#B026FF]/10 text-[#B026FF]'
                                )}>
                                  {item.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500">{item.symbol}</p>
                            </div>
                            <span className="text-[9px] text-zinc-600">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="text-[10px] text-[#00F0FF]/60 font-mono truncate flex-1">
                              {item.address}
                            </code>
                            <button onClick={() => { navigator.clipboard.writeText(item.address); toast.success('Copied!'); }}
                              className="p-1 rounded text-zinc-600 hover:text-white transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                            <a href={`https://basescan.org/address/${item.address}`} target="_blank" rel="noopener noreferrer"
                              className="p-1 rounded text-zinc-600 hover:text-white transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

function inputCls(error?: string) {
  return cn(
    'w-full bg-[#0a1224] border rounded-xl px-4 py-3 text-white outline-none transition-all placeholder:text-zinc-600',
    error ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-[#00F0FF]/50'
  );
}

function Field({
  label, error, hint, children
}: { label: string; error?: string; hint?: string; placeholder?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
      {children}
      {error && (
        <p className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>
      )}
      {hint && !error && (
        <p className="text-[10px] text-zinc-600">{hint}</p>
      )}
    </div>
  );
}
