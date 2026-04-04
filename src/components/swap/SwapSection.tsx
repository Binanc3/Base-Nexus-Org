import { parseUnits, formatUnits, formatEther, Address } from 'viem';
import { toast } from 'sonner';
import { erc20Abi, formatUnits, formatEther, type Address } from 'viem';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';
import type { QuoteWithTimestamp, SwapRecord, SwapStats } from '../../types/swap';

// ============================================================
// src/components/swap/SwapSection.tsx  — handleSwap function
//
// DROP-IN REPLACEMENT: Copy this entire block and replace the
// existing handleSwap function in your SwapSection component.
//
// Also add these imports at the TOP of SwapSection.tsx:
//
//   import { toast } from 'sonner';
//   import { erc20Abi, formatUnits, formatEther, type Address } from 'viem';
//   import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';
//   import type { QuoteWithTimestamp, SwapRecord, SwapStats } from '../../types/swap';
//
// Remove any existing import of 'react-hot-toast'.
// ============================================================

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Maximum age of a LI.FI quote before we refuse to use it.
 * LI.FI quotes are valid for ~30-60s — we use 45s to be safe.
 */
const QUOTE_MAX_AGE_MS = 45_000;

/**
 * How long to wait for a transaction receipt.
 * Bridge transactions can take several minutes, so we use 10 minutes.
 * For same-chain swaps this will resolve much faster.
 */
const TX_RECEIPT_TIMEOUT_MS = 600_000; // 10 minutes
const TX_POLLING_INTERVAL_MS = 3_000;  // poll every 3s

const handleSwap = async () => {
  // ── Pre-flight guards ──────────────────────────────────────
  if (!quote || !address || !publicClient) {
    toast.error('Wallet not connected or quote missing');
    return;
  }

  // ── Guard: quote freshness ─────────────────────────────────
  // LI.FI quotes expire. If the user waited too long, refuse early
  // and tell them to refresh — don't waste gas on a stale route.
  if (!quote.fetchedAt || Date.now() - quote.fetchedAt > QUOTE_MAX_AGE_MS) {
    toast.error('Quote has expired', {
      description: 'Please refresh the swap route and try again.',
    });
    return;
  }

  // ── Guard: source token address ────────────────────────────
  if (!quote.transactionRequest?.to) {
    toast.error('Invalid route: missing transaction target');
    return;
  }

  setIsSwapping(true);
  const toastId = toast.loading('Initializing swap…');

  try {
    // ── 1. NETWORK SWITCH ────────────────────────────────────
    // Switch BEFORE doing anything else so all subsequent calls
    // hit the right chain.
    const requiredChainId = quote.action.fromChainId ?? fromToken.chainId;
    if (chainId !== requiredChainId) {
      toast.loading(`Switching to ${fromToken.name}…`, { id: toastId });
      await switchChainAsync({ chainId: requiredChainId });
      // Allow wagmi state to settle after the chain switch
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // ── 2. APPEND BUILDER CODE ───────────────────────────────
    // Static import — no runtime surprises. Guard against
    // double-appending if the user retries without refreshing.
    const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
    const finalData: `0x${string}` = hasBuilderCode(rawData)
      ? rawData
      : appendBuilderCode(rawData);

    // ── 3. ALLOWANCE CHECK + APPROVAL ───────────────────────
    // Only needed for ERC-20 tokens (not native ETH/MATIC/etc.)
    const isNative = fromToken.address === NATIVE_TOKEN_ADDRESS ||
                     fromToken.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    if (!isNative) {
      toast.loading('Checking token allowance…', { id: toastId });

      // LI.FI provides the exact approval address — use it.
      // Falling back to transactionRequest.to is incorrect; the router
      // and the spender are different contracts inside LI.FI's architecture.
      const spender = (
        quote.estimate.approvalAddress ?? quote.transactionRequest.to
      ) as Address;

      const allowance = await publicClient.readContract({
        address: fromToken.address as Address,
        abi: erc20Abi,           // ← imported from 'viem', not declared inline
        functionName: 'allowance',
        args: [address as Address, spender],
      });

      const requiredAmount = BigInt(quote.estimate.fromAmount);

      if (allowance < requiredAmount) {
        toast.loading('Approval required — confirm in wallet…', { id: toastId });

        // Use exact amount (not MaxUint256) for security.
        // If you prefer infinite approval for UX, swap to: MaxUint256
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
        // Brief pause so the on-chain state propagates before we
        // call estimateGas (avoids false "insufficient allowance" errors)
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    // ── 4. GAS ESTIMATION ────────────────────────────────────
    // Let the node calculate actual gas — never hard-code it.
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
      // +20% buffer: standard DeFi practice for complex routes
      estimatedGas = (raw * 120n) / 100n;
    } catch (gasErr) {
      console.warn('[Swap] Gas estimation failed — using safe fallback', gasErr);
      // 600k is a safe upper bound for complex multi-hop LI.FI routes
      estimatedGas = 600_000n;
    }

    // ── 5. SEND TRANSACTION ──────────────────────────────────
    toast.loading('Confirm swap in wallet…', { id: toastId });

    const hash = await sendTransactionAsync({
      to: quote.transactionRequest.to as `0x${string}`,
      data: finalData,
      value: txValue,
      gas: estimatedGas,
    });

    if (!hash) throw new Error('Transaction was not submitted');

    toast.loading('Broadcasting to network…', { id: toastId });

    // ── 6. WAIT FOR RECEIPT ──────────────────────────────────
    // Bridge txs can take minutes. 10-minute timeout + fast polling.
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: TX_RECEIPT_TIMEOUT_MS,
      pollingInterval: TX_POLLING_INTERVAL_MS,
    });

    if (receipt.status === 'reverted') {
      throw new Error(
        'Transaction reverted on-chain. ' +
        'Try increasing slippage or refreshing the route.'
      );
    }

    // ── 7. RECORD HISTORY & STATS ────────────────────────────
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
      status: receipt.status,   // 'success' (reverted already thrown above)
      chainId: requiredChainId,
    };

    // Persist history — guarded so private browsing / quota doesn't crash state
    setHistory(prev => {
      const updated = [newSwap, ...prev].slice(0, 50);
      try {
        localStorage.setItem(
          `swap_history_${address}`,
          JSON.stringify(updated)
        );
      } catch (storageErr) {
        console.warn('[Storage] Could not persist swap history', storageErr);
      }
      return updated;
    });

    // Persist stats
    setStats((prev: SwapStats) => {
      const usdValue = parseFloat(quote.estimate.toAmountUSD ?? '0');
      const newStats: SwapStats = {
        totalVolume: (parseFloat(prev.totalVolume) + usdValue).toFixed(2),
        totalGas:    (parseFloat(prev.totalGas) + parseFloat(gasCostEth)).toFixed(8),
        swapCount:   prev.swapCount + 1,
      };
      try {
        localStorage.setItem(
          `swap_stats_${address}`,
          JSON.stringify(newStats)
        );
      } catch (storageErr) {
        console.warn('[Storage] Could not persist swap stats', storageErr);
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

    // Parse error into a user-friendly message
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
        // Trim long messages so the toast stays readable
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

    // 2. BUILDER CODE INTEGRATION
    // We do this early so we can estimate gas on the actual final data
    const txData = (quote.transactionRequest.data as `0x${string}`) || '0x';
    const { appendBuilderCode } = await import('../../lib/wagmi');
    const finalData = appendBuilderCode(txData);

    // 3. ALLOWANCE CHECK (The "Brain" must handle approvals)
    // Most swaps fail because the user hasn't approved the contract to spend their tokens
    if (fromToken.address !== '0x0000000000000000000000000000000000000000') {
      toast.loading("Checking allowance...", { id: toastId });
      
      // Note: You should have a useReadContract hook for allowance or fetch it here
      // This is a placeholder for the logic:
      const allowance = await publicClient.readContract({
        address: fromToken.address as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, quote.transactionRequest.to as Address],
      });

      if (allowance < BigInt(quote.estimate.fromAmount)) {
        toast.loading("Approval required...", { id: toastId });
        const approveHash = await writeContractAsync({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [quote.transactionRequest.to as Address, BigInt(quote.estimate.fromAmount)],
        });
        toast.loading("Confirming approval...", { id: toastId });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        toast.success("Token approved!", { id: toastId });
      }
    }

    // 4. DYNAMIC GAS ESTIMATION
    // Instead of manual math, ask the node what it will actually cost.
    toast.loading("Estimating gas...", { id: toastId });
    let estimatedGas;
    try {
      estimatedGas = await publicClient.estimateGas({
        account: address,
        to: quote.transactionRequest.to as Address,
        data: finalData,
        value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      });
      // Add a 20% buffer for safety (standard practice in DeFi)
      estimatedGas = (estimatedGas * 120n) / 100n;
    } catch (e) {
      console.warn("[Swap] Gas estimation failed, using fallback", e);
      estimatedGas = 500000n; // Safe fallback for complex swaps
    }

    // 5. EXECUTE TRANSACTION
    toast.loading("Confirm swap in wallet...", { id: toastId });
    
    const hash = await sendTransactionAsync({
      to: quote.transactionRequest.to as `0x${string}`,
      data: finalData,
      value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      gas: estimatedGas,
    });

    if (!hash) throw new Error("User rejected or transaction failed to submit");

    toast.loading("Finalizing on-chain...", { id: toastId });
    
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 60_000 
    });

    if (receipt.status === 'reverted') {
      throw new Error("Transaction reverted on-chain. Check slippage or liquidity.");
    }

    // 6. UPDATE HISTORY & STATS
    const gasCost = receipt.effectiveGasPrice 
      ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice) 
      : '0';

    const newSwap = {
      hash,
      from: fromToken.symbol,
      to: toToken.symbol,
      amount: `${Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)).toFixed(4)}`,
      timestamp: Date.now(),
      gasUsed: gasCost
    };

    // Update state using functional updates to ensure data integrity
    setHistory(prev => {
      const updated = [newSwap, ...prev].slice(0, 50);
      localStorage.setItem(`swap_history_${address}`, JSON.stringify(updated));
      return updated;
    });

    setStats(prev => {
      const usdValue = parseFloat(quote.estimate.toAmountUSD || '0');
      const newStats = {
        totalVolume: (parseFloat(prev.totalVolume) + usdValue).toFixed(2),
        totalGas: (parseFloat(prev.totalGas) + parseFloat(gasCost)).toString(),
        swapCount: prev.swapCount + 1
      };
      localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
      return newStats;
    });

    toast.success("Swap completed successfully!", { id: toastId });

  } catch (error: any) {
    console.error('[Swap Error]', error);
    
    let userMessage = "Swap failed";
    if (error.message?.includes("User rejected")) userMessage = "Transaction rejected";
    if (error.message?.includes("insufficient funds")) userMessage = "Insufficient gas (ETH/MATIC)";
    
    toast.error(userMessage, { 
      id: toastId, 
      description: error.shortMessage || error.message?.substring(0, 60) 
    });
  } finally {
    setIsSwapping(false);
  }
};
