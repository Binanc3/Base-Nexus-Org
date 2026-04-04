const handleSwap = async () => {
  if (!quote || !address) return;
  
  setIsSwapping(true);
  const toastId = toast.loading("Preparing swap...");
  
  try {
    // 1. Ensure correct chain
    if (chainId !== fromToken.chainId) {
      toast.loading("Switching network...", { id: toastId });
      await switchChainAsync({ chainId: fromToken.chainId });
    }

    // 2. Execute transaction with proper data handling
    toast.loading("Confirm swap in wallet...", { id: toastId });
    
    // Get the transaction data from quote
    const txData = quote.transactionRequest.data as `0x${string}` || '0x';
    
    // Append builder code properly
    const { appendBuilderCode } = await import('../../lib/wagmi');
    const finalData = appendBuilderCode(txData);

    console.log('[Swap] Sending with data:', finalData, 'to:', quote.transactionRequest.to);

    // Calculate proper gas
    const baseGas = 21000n; // Base gas for transaction
    const dataGas = 4n * BigInt((finalData.length - 2) / 2); // 4 gas per byte of data
    const estimatedGas = baseGas + dataGas + 50000n; // Add buffer for contract execution

    const hash = await sendTransactionAsync({
      to: quote.transactionRequest.to as `0x${string}`,
      data: finalData,
      value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      gas: estimatedGas,
    });

    if (!hash) {
      throw new Error("Swap was not submitted to the network");
    }

    console.log('[Swap] Transaction hash:', hash);

    toast.loading("Waiting for confirmation...", { id: toastId });
    
    if (publicClient) {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ 
          hash,
          timeout: 120_000, // 2 minute timeout
        });
        
        console.log('[Swap] Receipt:', receipt);
        
        if (receipt.status === 'reverted') {
          throw new Error("Swap failed onchain - insufficient liquidity or price impact too high");
        }

        // 3. Update history and stats
        const newSwap = {
          hash,
          from: fromToken.symbol,
          to: toToken.symbol,
          amount: `${Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)).toFixed(4)} ${toToken.symbol}`,
          timestamp: Date.now(),
          gasUsed: receipt.gasUsed ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice) : '0.001'
        };

        setHistory(prev => {
          const updated = [newSwap, ...prev].slice(0, 50);
          localStorage.setItem(`swap_history_${address}`, JSON.stringify(updated));
          return updated;
        });

        setStats(prev => {
          const usdValue = parseFloat(quote.estimate.toAmountUSD || '0');
          const newStats = {
            totalVolume: (parseFloat(prev.totalVolume) + usdValue).toString(),
            totalGas: (parseFloat(prev.totalGas) + parseFloat(newSwap.gasUsed)).toString(),
            swapCount: prev.swapCount + 1
          };
          localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
          return newStats;
        });

        toast.success("Swap successful!", { id: toastId });
      } catch (waitError) {
        console.error('[Swap] Receipt wait error:', waitError);
        // Transaction submitted successfully even if we can't wait for receipt
        toast.success("Swap submitted!", { 
          id: toastId,
          description: "Check BaseScan in a few seconds"
        });
      }
    }
  } catch (error: any) {
    console.error('[Swap] Swap failed:', error);
    const errorMessage = error.message || "Swap failed - check console for details";
    toast.error("Swap Failed", { id: toastId, description: errorMessage.substring(0, 100) });
  } finally {
    setIsSwapping(false);
  }
};
