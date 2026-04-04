import { parseUnits, formatUnits, formatEther, Address } from 'viem';
import { toast } from 'react-hot-toast'; // Assuming react-hot-toast

const handleSwap = async () => {
  if (!quote || !address || !publicClient) return;
  
  setIsSwapping(true);
  const toastId = toast.loading("Initializing swap...");
  
  try {
    // 1. NETWORK CHECK & SWITCH
    if (chainId !== fromToken.chainId) {
      toast.loading("Switching to " + fromToken.name + "...", { id: toastId });
      await switchChainAsync({ chainId: fromToken.chainId });
      // Short delay to allow wagmi state to sync after chain switch
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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
