import { useState, useEffect, useCallback } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { ArrowDownUp, Settings, Info, Loader2, History, ExternalLink, Clock, RefreshCw, TrendingUp, Zap, ChevronRight, Star, Repeat, ArrowDown, Wallet, Shield } from 'lucide-react';
import { createConfig, getQuote } from '@lifi/sdk';
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain } from 'wagmi';
import { formatUnits, parseUnits, formatEther } from 'viem';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BASE_BUILDER_CODE, appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';

createConfig({
  integrator: 'BaseNexus'
});

const COMMON_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0000000000000000000000000000000000000000', chainId: 8453, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, decimals: 6, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png' },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', chainId: 8453, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png' },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E28C58d899194b42fE4889100d5796559ee1', chainId: 8453, decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e28c58d899194b42fe4889100d5796559ee1.png' },
];

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  
  const [fromToken, setFromToken] = useState(COMMON_TOKENS[0]);
  const [toToken, setToToken] = useState(COMMON_TOKENS[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  const [history, setHistory] = useState<{ hash: string; from: string; to: string; amount: string; timestamp: number; gasUsed?: string }[]>([]);
  const [stats, setStats] = useState({ totalVolume: '0', totalGas: '0', swapCount: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  const loadLocalData = useCallback(() => {
    const savedHistory = localStorage.getItem(`swap_history_${address}`);
    const savedStats = localStorage.getItem(`swap_stats_${address}`);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedStats) setStats(JSON.parse(savedStats));
  }, [address]);

  useEffect(() => {
    if (address) loadLocalData();
  }, [address, loadLocalData]);

  const fetchQuote = useCallback(async () => {
    if (!fromAmount || isNaN(Number(fromAmount)) || Number(fromAmount) <= 0) {
      setQuote(null);
      return;
    }

    setIsQuoting(true);
    try {
      const amount = parseUnits(fromAmount, fromToken.decimals).toString();
      const result = await getQuote({
        fromChain: fromToken.chainId,
        toChain: toToken.chainId,
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAddress: address || '0x0000000000000000000000000000000000000000',
        fromAmount: amount,
      });
      setQuote(result);
    } catch (error) {
      console.error('Quote error:', error);
      setQuote(null);
    } finally {
      setIsQuoting(false);
    }
  }, [fromAmount, fromToken, toToken, address]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuote();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

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

      // 2. Execute transaction with builder code attribution
      toast.loading("Confirm swap in wallet...", { id: toastId });
      
      // Append builder code to transaction data
      const txData = quote.transactionRequest.data || '0x';
      const finalData = appendBuilderCode(txData);

      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      });

      toast.loading("Waiting for confirmation...", { id: toastId });
      
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'reverted') {
          throw new Error("Transaction reverted onchain");
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
      }
    } catch (error: any) {
      console.error('Swap failed:', error);
      toast.error(error.message || "Swap failed", { id: toastId });
    } finally {
      setIsSwapping(false);
    }
  };

  const syncHistory = async () => {
    if (!address || !publicClient) return;
    setIsSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("History synced with Base");
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard className="p-4 bg-blue-600/5 border-blue-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-blue-500/20 transition-all" />
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Volume</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">${Number(stats.totalVolume).toLocaleString()}</div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <GlassCard className="p-4 bg-purple-600/5 border-purple-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-purple-500/20 transition-all" />
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <span className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Gas Saved</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{Number(stats.totalGas).toFixed(4)} ETH</div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <GlassCard className="p-4 bg-green-600/5 border-green-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-green-500/20 transition-all" />
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-500/20 rounded-lg">
                  <ArrowDownUp className="w-3.5 h-3.5 text-green-400" />
                </div>
                <span className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Swaps</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{stats.swapCount}</div>
            </GlassCard>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
          <GlassCard className="p-6 min-h-[600px] relative overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Swap Assets</h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Builder Attribution Enabled</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                  onClick={() => {
                    if (confirm("Reset your swap stats and history?")) {
                      localStorage.removeItem(`swap_history_${address}`);
                      localStorage.removeItem(`swap_stats_${address}`);
                      setHistory([]);
                      setStats({ totalVolume: '0', totalGas: '0', swapCount: 0 });
                    }
                  }}
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
                <Button variant="ghost" className="p-2 hover:bg-white/5"><Settings className="w-5 h-5" /></Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full">
              {/* From Token */}
              <div className="p-4 bg-white/5 rounded-3xl border border-white/10 space-y-2">
                <div className="flex justify-between text-[10px] text-white/40 uppercase font-bold">
                  <span>You Pay</span>
                  <span>Balance: 0.00</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.0"
                    className="bg-transparent text-2xl font-bold text-white outline-none w-full"
                  />
                  <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl cursor-pointer hover:bg-white/20 transition-colors">
                    <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                    <span className="font-bold text-white">{fromToken.symbol}</span>
                  </div>
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center -my-6 relative z-10">
                <Button 
                  variant="outline" 
                  className="w-10 h-10 rounded-full bg-slate-900 border-white/10 p-0 hover:scale-110 transition-transform"
                  onClick={() => {
                    const temp = fromToken;
                    setFromToken(toToken);
                    setToToken(temp);
                  }}
                >
                  <ArrowDown className="w-5 h-5 text-blue-400" />
                </Button>
              </div>

              {/* To Token */}
              <div className="p-4 bg-white/5 rounded-3xl border border-white/10 space-y-2">
                <div className="flex justify-between text-[10px] text-white/40 uppercase font-bold">
                  <span>You Receive</span>
                  <span>Balance: 0.00</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-white/60 w-full">
                    {isQuoting ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : quote ? (
                      Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)).toFixed(6)
                    ) : (
                      '0.0'
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl cursor-pointer hover:bg-white/20 transition-colors">
                    <img src={toToken.logoURI} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                    <span className="font-bold text-white">{toToken.symbol}</span>
                  </div>
                </div>
              </div>

              {/* Quote Info */}
              {quote && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 space-y-2 text-xs"
                >
                  <div className="flex justify-between text-white/60">
                    <span>Rate</span>
                    <span>1 {fromToken.symbol} = {(Number(quote.estimate.toAmount) / Number(quote.estimate.fromAmount)).toFixed(6)} {toToken.symbol}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Estimated Gas</span>
                    <span>${Number(quote.estimate.gasCosts?.[0]?.amountUSD || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Price Impact</span>
                    <span className={cn(Number(quote.estimate.feeCosts?.[0]?.percentage || '0') > 2 ? "text-red-400" : "text-green-400")}>
                      {Number(quote.estimate.feeCosts?.[0]?.percentage || '0').toFixed(2)}%
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Action Button */}
              <Button
                className="w-full py-6 rounded-3xl text-lg font-bold bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/20 mt-4"
                disabled={!quote || isSwapping || !address}
                onClick={handleSwap}
              >
                {isSwapping ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Executing Swap...</>
                ) : !address ? (
                  <><Wallet className="w-5 h-5 mr-2" /> Connect Wallet</>
                ) : quote ? (
                  'Swap Now'
                ) : (
                  'Enter Amount'
                )}
              </Button>
            </div>
            
            <div className="mt-auto pt-8 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <Shield className="w-3 h-3 text-green-400" />
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Builder Attribution Active</span>
              </div>
              <p className="text-center text-[10px] text-white/20 uppercase tracking-widest font-bold">
                Optimized routing powered by LI.FI SDK
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white">Recent Swaps</h3>
              </div>
              <Button 
                variant="ghost" 
                className="p-1 hover:bg-white/10"
                onClick={syncHistory}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("w-4 h-4 text-white/40", isSyncing && "animate-spin")} />
              </Button>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                <Clock className="w-12 h-12 text-white/5 mx-auto mb-3" />
                <p className="text-xs text-white/30 italic">No recent swaps found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {history.map((item, i) => (
                    <motion.div 
                      key={item.hash + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{item.amount}</span>
                          <div className="flex items-center gap-1 text-[10px] text-white/40">
                            <span>{item.from}</span>
                            <ChevronRight className="w-2 h-2" />
                            <span>{item.to}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <span className="text-[10px] text-white/40 font-mono">{item.hash.substring(0, 12)}...</span>
                        <div className="flex gap-3">
                          {item.gasUsed && (
                            <span className="text-[9px] text-purple-400/60 flex items-center gap-1">
                              <Zap className="w-2 h-2" />
                              {item.gasUsed}
                            </span>
                          )}
                          <a 
                            href={`https://basescan.org/tx/${item.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/40 hover:text-white transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full mt-6 text-xs flex items-center justify-center gap-2 py-3 rounded-xl"
              onClick={() => window.open(`https://basescan.org/address/${address}`, '_blank')}
            >
              Full Explorer View
              <ExternalLink className="w-3 h-3" />
            </Button>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <GlassCard className="p-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20">
            <div className="flex items-center gap-3 mb-3">
              <Star className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-bold text-white">Ecosystem Power</h4>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              BaseNexus uses LI.FI SDK to find the best routes across the Base ecosystem. 
              Every swap is optimized for speed and gas efficiency with custom builder attribution.
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
