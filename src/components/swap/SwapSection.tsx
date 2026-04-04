import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Repeat, ArrowDown, Activity } from 'lucide-react';
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useWriteContract,
  useSwitchChain,
} from 'wagmi';
import { erc20Abi, formatUnits, formatEther, type Address } from 'viem';
import { toast } from 'sonner';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';
import type { SwapRecord, SwapStats } from '../../types/swap';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const QUOTE_MAX_AGE_MS = 45_000;
const TX_RECEIPT_TIMEOUT_MS = 600_000;
const TX_POLLING_INTERVAL_MS = 3_000;

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [quote, setQuote] = useState<any>(null);
  
  // NOTE: Initializing these to valid placeholders so the UI renders. 
  // You will need to wire up a token selector!
  const [fromToken, setFromToken] = useState<any>({ symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, chainId: 8453 });
  const [toToken, setToToken] = useState<any>({ symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, chainId: 8453 });
  
  const [isSwapping, setIsSwapping] = useState(false);
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

  const handleSwap = async () => {
    if (!quote || !address || !publicClient) {
      toast.error('Wallet not connected or quote missing');
      return;
    }

    if (!quote.fetchedAt || Date.now() - quote.fetchedAt > QUOTE_MAX_AGE_MS) {
      toast.error('Quote has expired', {
        description: 'Please refresh the swap route and try again.',
      });
      return;
    }

    if (!quote.transactionRequest?.to) {
      toast.error('Invalid route: missing transaction target');
      return;
    }

    setIsSwapping(true);
    const toastId = toast.loading('Initializing swap…');

    try {
      const requiredChainId = quote.action.fromChainId ?? fromToken.chainId;
      if (chainId !== requiredChainId) {
        toast.loading(`Switching to ${fromToken.name}…`, { id: toastId });
        await switchChainAsync({ chainId: requiredChainId });
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData: `0x${string}` = hasBuilderCode(rawData)
        ? rawData
        : appendBuilderCode(rawData);

      const isNative =
        fromToken.address === NATIVE_TOKEN_ADDRESS ||
        fromToken.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      if (!isNative) {
        toast.loading('Checking token allowance…', { id: toastId });

        const spender = (
          quote.estimate.approvalAddress ?? quote.transactionRequest.to
        ) as Address;

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

          if (approvalReceipt.status === 'reverted') {
            throw new Error('Token approval transaction reverted on-chain.');
          }

          toast.success('Token approved!', { id: toastId });
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      toast.loading('Estimating gas…', { id: toastId });

      const txValue = quote.transactionRequest.value
        ? BigInt(quote.transactionRequest.value as string)
        : 0n;

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

      toast.loading('Confirm swap in wallet…', { id: toastId });

      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: txValue,
        gas: estimatedGas,
      });

      if (!hash) throw new Error('Transaction was not submitted');

      toast.loading('Broadcasting to network…', { id: toastId });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_RECEIPT_TIMEOUT_MS,
        pollingInterval: TX_POLLING_INTERVAL_MS,
      });

      if (receipt.status === 'reverted') {
        throw new Error(
          'Transaction reverted on-chain. Try increasing slippage or refreshing the route.'
        );
      }

      const gasCostEth = receipt.effectiveGasPrice
        ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice)
        : '0';

      const newSwap: SwapRecord = {
        hash,
        from: fromToken.symbol,
        to: toToken.symbol,
        fromAmount: formatUnits(BigInt(quote.estimate.fromAmount), fromToken.decimals),
        toAmount:   formatUnits(BigInt(quote.estimate.toAmount),   toToken.decimals),
        fromAmountUSD: quote.estimate.fromAmountUSD ?? '0',
        toAmountUSD:   quote.estimate.toAmountUSD   ?? '0',
        timestamp: Date.now(),
        gasUsed: gasCostEth,
        status: receipt.status,
        chainId: requiredChainId,
      };

      setHistory(prev => {
        const updated = [newSwap, ...prev].slice(0, 50);
        try {
          localStorage.setItem(`swap_history_${address}`, JSON.stringify(updated));
        } catch (e) {
          console.warn('[Storage] Could not persist swap history', e);
        }
        return updated;
      });

      setStats((prev: SwapStats) => {
        const usdValue = parseFloat(quote.estimate.toAmountUSD ?? '0');
        const newStats: SwapStats = {
          totalVolume: (parseFloat(prev.totalVolume) + usdValue).toFixed(2),
          totalGas:    (parseFloat(prev.totalGas) + parseFloat(gasCostEth)).toFixed(8),
          swapCount:   prev.swapCount + 1,
        };
        try {
          localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
        } catch (e) {
          console.warn('[Storage] Could not persist swap stats', e);
        }
        return newStats;
      });

      toast.success('Swap completed!', {
        id: toastId,
        description: `${newSwap.fromAmount} ${fromToken.symbol} → ${newSwap.toAmount} ${toToken.symbol}`,
        duration: 6000,
      });

    } catch (error: unknown) {
      console.error('[Swap Error]', error);

      let title = 'Swap failed';
      let description = 'An unexpected error occurred';

      if (error instanceof Error) {
        const msg = error.message ?? '';
        if (msg.includes('User rejected') || msg.includes('user rejected')) {
          title = 'Transaction rejected';
          description = 'You cancelled the transaction in your wallet.';
        } else if (msg.includes('insufficient funds')) {
          title = 'Insufficient gas';
          description = `You need more ${fromToken.chainId === 8453 ? 'ETH on Base' : 'native token'} to cover gas.`;
        } else if (msg.includes('reverted')) {
          title = 'Transaction reverted';
          description = 'Try increasing slippage tolerance or refreshing the route.';
        } else if (msg.includes('expired') || msg.includes('Quote')) {
          title = 'Quote expired';
          description = 'Please refresh the swap route and try again.';
        } else if (msg.includes('timeout')) {
          title = 'Confirmation timeout';
          description = 'Transaction may still confirm — check your wallet history.';
        } else {
          description = msg.substring(0, 100);
        }
      }

      toast.error(title, {
        id: toastId,
        description,
        duration: 8000,
      });

    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <GlassCard className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
            <Repeat className="w-7 h-7 text-blue-400" />
            Nexus Swap
          </h2>
        </div>

        <div className="space-y-2">
          {/* Pay Section */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
            <label className="text-xs text-white/50 font-bold uppercase tracking-wider mb-3 block">You Pay</label>
            <div className="flex justify-between items-center">
              <input 
                type="number" 
                className="bg-transparent text-4xl font-bold text-white outline-none w-2/3 placeholder:text-white/20" 
                placeholder="0.0" 
                onChange={(e) => {
                  // Connect your quote fetching logic to this input
                  // setAmount(e.target.value) -> trigger API
                }}
              />
              <div className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl font-bold border border-blue-500/20 flex items-center gap-2 cursor-pointer hover:bg-blue-600/30">
                {fromToken?.symbol || 'ETH'}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex justify-center -my-5 relative z-10">
            <button className="bg-[#0a1628] border border-white/10 p-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all shadow-xl">
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>

          {/* Receive Section */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
            <label className="text-xs text-white/50 font-bold uppercase tracking-wider mb-3 block">You Receive</label>
            <div className="flex justify-between items-center">
              <input 
                type="number" 
                disabled
                className="bg-transparent text-4xl font-bold text-white/50 outline-none w-2/3 placeholder:text-white/20" 
                placeholder="0.0" 
                value={quote?.estimate?.toAmount ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals) : ''}
              />
              <div className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl font-bold border border-blue-500/20 flex items-center gap-2 cursor-pointer hover:bg-blue-600/30">
                {toToken?.symbol || 'USDC'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleSwap} 
          disabled={isSwapping}
          className="w-full mt-8 py-5 text-lg font-bold"
        >
          {isSwapping ? 'Swapping...' : 'Swap Tokens'}
        </Button>
      </GlassCard>
      
      {/* Transaction History */}
      {history.length > 0 && (
        <GlassCard className="p-6">
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
