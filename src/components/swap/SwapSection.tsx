import { useState } from 'react';
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
  const [fromToken, setFromToken] = useState<any>(null);
  const [toToken, setToToken] = useState<any>(null);
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

      // 1. NETWORK SWITCH
      const requiredChainId = quote.action.fromChainId ?? fromToken.chainId;
      if (chainId !== requiredChainId) {
        toast.loading(`Switching to ${fromToken.name}…`, { id: toastId });
        await switchChainAsync({ chainId: requiredChainId });
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      // 2. APPEND BUILDER CODE
      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData: `0x${string}` = hasBuilderCode(rawData)
        ? rawData
        : appendBuilderCode(rawData);

      // 3. ALLOWANCE CHECK + APPROVAL
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

      // 4. GAS ESTIMATION
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

      // 5. SEND TRANSACTION
      toast.loading('Confirm swap in wallet…', { id: toastId });

      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: txValue,
        gas: estimatedGas,
      });

      if (!hash) throw new Error('Transaction was not submitted');

      toast.loading('Broadcasting to network…', { id: toastId });

      // 6. WAIT FOR RECEIPT
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

      // 7. RECORD HISTORY & STATS
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
    <div>
      {/* Your swap UI — wire up setQuote, fromToken, toToken, history, stats as needed */}
      <button onClick={handleSwap} disabled={isSwapping}>
        {isSwapping ? 'Swapping…' : 'Swap'}
      </button>
    </div>
  );
}
