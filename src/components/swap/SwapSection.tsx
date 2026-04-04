import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Route, Wallet, Activity } from 'lucide-react';
import {
  useAccount,
  useBalance,
  usePublicClient,
  useSendTransaction,
  useWriteContract,
  useSwitchChain,
} from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, formatEther, type Address } from 'viem';
import { toast } from 'sonner';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';
import type { SwapRecord, SwapStats } from '../../types/swap';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const QUOTE_MAX_AGE_MS = 45_000;
const TX_RECEIPT_TIMEOUT_MS = 600_000;
const TX_POLLING_INTERVAL_MS = 3_000;

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logo: 'Ξ', chainId: 8453 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logo: '$', chainId: 8453 },
  { symbol: 'DEGEN', name: 'Degen Token', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, logo: '🎩', chainId: 8453 }
];

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  const [history, setHistory] = useState<SwapRecord[]>(() => {
    try {
      const stored = localStorage.getItem(`swap_history_${address}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState<SwapStats>(() => {
    try {
      const stored = localStorage.getItem(`swap_stats_${address}`);
      return stored ? JSON.parse(stored) : { totalVolume: '0', totalGas: '0', swapCount: 0 };
    } catch {
      return { totalVolume: '0', totalGas: '0', swapCount: 0 };
    }
  });

  const { data: fromBalance } = useBalance({
    address,
    token: fromToken.address === NATIVE_TOKEN_ADDRESS ? undefined : fromToken.address as Address,
  });

  // ─── Fetch LI.FI Quote ──────────────────────────────────────
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address) {
        setQuote(null);
        setIsFetchingQuote(false);
        return;
      }

      setIsFetchingQuote(true);
      try {
        const parsedAmount = parseUnits(amount, fromToken.decimals).toString();
        const response = await fetch(
          `https://li.quest/v1/quote?fromChain=${fromToken.chainId}&toChain=${toToken.chainId}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}&slippage=${parseFloat(slippage) / 100}`
        );
        
        const data = await response.json();
        
        if (data.transactionRequest) {
          setQuote(data);
        } else {
          setQuote(null);
        }
      } catch (error) {
        console.error("LI.FI Quote Error:", error);
        setQuote(null);
      } finally {
        setIsFetchingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 600);
    return () => clearTimeout(timeoutId);
  }, [amount, fromToken, toToken, address, slippage]);

  // ─── Execute Swap ───────────────────────────────────────────
  const handleSwap = async () => {
    if (!quote || !address || !publicClient) {
      toast.error('Wallet not connected or quote missing');
      return;
    }

    if (!quote.transactionRequest?.to) {
      toast.error('Invalid route: missing transaction target');
      return;
    }

    setIsSwapping(true);
    const toastId = toast.loading('Initializing swap…');

    try {
      // 1. Network Switch
      const requiredChainId = quote.action.fromChainId ?? fromToken.chainId;
      if (chainId !== requiredChainId) {
        toast.loading(`Switching to ${fromToken.name}…`, { id: toastId });
        await switchChainAsync({ chainId: requiredChainId });
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      // 2. Append Builder Code
      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData: `0x${string}` = hasBuilderCode(rawData)
        ? rawData
        : appendBuilderCode(rawData);

      // 3. Allowance Check
      const isNative = fromToken.address === NATIVE_TOKEN_ADDRESS;
      if (!isNative) {
        toast.loading('Checking token allowance…', { id: toastId });
        const spender = (quote.estimate.approvalAddress ?? quote.transactionRequest.to) as Address;
        const allowance = await publicClient.readContract({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address as Address, spender],
        });

        const requiredAmount = BigInt(quote.estimate.fromAmount);

        if (allowance < requiredAmount) {
          toast.loading('Approval required — confirm in wallet…', { id: toastId });
          const approveHash = await writeContractAsync({
            address: fromToken.address as Address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, requiredAmount],
          });

          toast.loading('Waiting for approval confirmation…', { id: toastId });
          const approvalReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
            timeout: 60_000,
            pollingInterval: TX_POLLING_INTERVAL_MS,
          });

          if (approvalReceipt.status === 'reverted') throw new Error('Token approval reverted on-chain.');
          toast.success('Token approved!', { id: toastId });
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      // 4. Gas Estimation
      toast.loading('Estimating gas…', { id: toastId });
      const txValue = quote.transactionRequest.value ? BigInt(quote.transactionRequest.value as string) : 0n;
      let estimatedGas: bigint;
      try {
        const raw = await publicClient.estimateGas({
          account: address as Address,
          to: quote.transactionRequest.to as Address,
          data: finalData,
          value: txValue,
        });
        estimatedGas = (raw * 120n) / 100n;
      } catch (gasErr) {
        console.warn('[Swap] Gas estimation failed — using safe fallback', gasErr);
        estimatedGas = 600_000n;
      }

      // 5. Send Transaction
      toast.loading('Confirm swap in wallet…', { id: toastId });
      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: txValue,
        gas: estimatedGas,
      });

      if (!hash) throw new Error('Transaction was not submitted');

      // 6. Wait for Receipt
      toast.loading('Broadcasting to network…', { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_RECEIPT_TIMEOUT_MS,
        pollingInterval: TX_POLLING_INTERVAL_MS,
      });

      if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain. Try increasing slippage.');

      // 7. Record Stats
      const gasCostEth = receipt.effectiveGasPrice ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice) : '0';
      const newSwap: SwapRecord = {
        hash,
        from: fromToken.symbol,
        to: toToken.symbol,
        fromAmount: formatUnits(BigInt(quote.estimate.fromAmount), fromToken.decimals),
        toAmount: formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals),
        fromAmountUSD: quote.estimate.fromAmountUSD ?? '0',
        toAmountUSD: quote.estimate.toAmountUSD ?? '0',
        timestamp: Date.now(),
        gasUsed: gasCostEth,
        status: receipt.status,
        chainId: requiredChainId,
      };

      setHistory(prev => {
        const updated = [newSwap, ...prev].slice(0, 50);
        localStorage.setItem(`swap_history_${address}`, JSON.stringify(updated));
        return updated;
      });

      setStats(prev => {
        const usdValue = parseFloat(quote.estimate.toAmountUSD ?? '0');
        const newStats = {
          totalVolume: (parseFloat(prev.totalVolume) + usdValue).toFixed(2),
          totalGas: (parseFloat(prev.totalGas) + parseFloat(gasCostEth)).toFixed(8),
          swapCount: prev.swapCount + 1,
        };
        localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
        return newStats;
      });

      toast.success('Swap completed!', {
        id: toastId,
        description: `${newSwap.fromAmount} ${fromToken.symbol} → ${newSwap.toAmount} ${toToken.symbol}`,
        duration: 6000,
      });
      setAmount('');

    } catch (error: any) {
      console.error('[Swap Error]', error);
      let title = 'Swap failed';
      let description = 'An unexpected error occurred';

      if (error.message?.includes('User rejected')) {
        title = 'Transaction rejected';
        description = 'You cancelled the transaction in your wallet.';
      } else if (error.message?.includes('insufficient funds')) {
        title = 'Insufficient gas';
        description = `You need more ETH to cover gas.`;
      } else {
        description = error.message?.substring(0, 100) || 'Error processing swap.';
      }
      toast.error(title, { id: toastId, description, duration: 8000 });
    } finally {
      setIsSwapping(false);
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header & Settings */}
      <div className="flex justify-between items-center px-2 mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">Nexus Swap</h2>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {showSettings && (
        <GlassCard className="p-4 mb-4">
          <div className="text-sm font-bold text-white/80 mb-3">Max Slippage</div>
          <div className="flex gap-2">
            {['0.1', '0.5', '1.0'].map(val => (
              <button key={val} onClick={() => setSlippage(val)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${slippage === val ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-black/20 border-white/10 text-white/60'}`}>
                {val}%
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Main Swap Interface */}
      <GlassCard className="p-1 overflow-hidden">
        {/* FROM BLOCK */}
        <div className="bg-[#131b2c] p-5 rounded-t-2xl">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white/60 font-medium">You Pay</span>
            <span className="text-white/60 flex items-center gap-1">
              <Wallet className="w-3 h-3" /> 
              {fromBalance ? Number(fromBalance.formatted).toFixed(4) : '0.00'}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <input 
              type="number" 
              placeholder="0.0" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="bg-transparent text-4xl font-bold text-white outline-none w-full" 
            />
            <button className="flex items-center gap-2 bg-black/40 hover:bg-black/60 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-lg">{fromToken.logo}</span>
              <span className="font-bold text-white">{fromToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* SWITCH BUTTON DIVIDER */}
        <div className="relative h-1 bg-[#0a101d]">
          <button onClick={switchTokens} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a2336] p-2 rounded-xl border-4 border-[#0a101d] text-white/60 hover:text-white hover:rotate-180 transition-all duration-300">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* TO BLOCK */}
        <div className="bg-[#131b2c] p-5 rounded-b-2xl">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white/60 font-medium">You Receive</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <input 
              type="text" 
              disabled 
              value={quote ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals) : ''} 
              placeholder={isFetchingQuote ? "Finding best route..." : "0.0"} 
              className="bg-transparent text-4xl font-bold text-white/50 outline-none w-full" 
            />
            <button className="flex items-center gap-2 bg-black/40 hover:bg-black/60 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-lg">{toToken.logo}</span>
              <span className="font-bold text-white">{toToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Routing Info */}
      {quote && (
        <div className="px-4 py-3 bg-[#131b2c]/80 rounded-2xl border border-white/5 space-y-2 text-sm animate-in fade-in">
          <div className="flex justify-between items-center">
            <span className="text-white/50 flex items-center gap-2"><Route className="w-4 h-4" /> Best Route</span>
            <span className="text-blue-400 font-bold">via LI.FI</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/50">Network Fee</span>
            <span className="text-white/80">
              ${parseFloat(quote.estimate.gasCosts?.[0]?.amountUSD || '0').toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button 
        onClick={handleSwap} 
        disabled={isSwapping || isFetchingQuote || !amount} 
        className="w-full py-5 text-lg font-bold rounded-2xl"
      >
        {isSwapping ? 'Processing Swap...' : isFetchingQuote ? 'Fetching Route...' : amount ? 'Review Swap' : 'Enter Amount'}
      </Button>

      {/* Transaction History UI */}
      {history.length > 0 && (
        <GlassCard className="p-6 mt-6">
           <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Recent Swaps
          </h3>
          <div className="space-y-3">
             {history.map((tx, i) => (
                <div key={i} className="flex justify-between text-xs p-3 bg-white/5 rounded-xl border border-white/5">
                   <span className="text-white/80">{tx.fromAmount} {tx.from} ➔ {tx.toAmount} {tx.to}</span>
                   <span className="text-green-400 font-mono">Confirmed</span>
                </div>
             ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
