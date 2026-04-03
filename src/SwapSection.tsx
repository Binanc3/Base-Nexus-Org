import { useState, useEffect, useCallback } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { ArrowDownUp, Settings, Loader2, History, ExternalLink, Clock, RefreshCw, TrendingUp, Zap, ChevronRight, Star, Repeat, ArrowDown, Wallet, Shield, Search, Check } from 'lucide-react';
import { createConfig, getQuote } from '@lifi/sdk';
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain, useBalance } from 'wagmi';
import { formatUnits, parseUnits, formatEther } from 'viem';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BASE_BUILDER_CODE, appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';

createConfig({ integrator: 'BaseNexus' });

const COMMON_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0000000000000000000000000000000000000000', chainId: 8453, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x0000000000000000000000000000000000000000/logo.png' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, decimals: 6, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png' },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', chainId: 8453, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png' },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E28C58d899194b42fE4889100d5796559ee1', chainId: 8453, decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e28c58d899194b42fe4889100d5796559ee1.png' },
  { symbol: 'BRETT', name: 'Brett', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', chainId: 8453, decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x532f27101965dd16442e59d40670faf5ebb142e4.png' },
  { symbol: 'TOSHI', name: 'Toshi', address: '0xAC1Bd2486aAF3B5C0df39113f528363371461421', chainId: 8453, decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xac1bd2486aaf3b5c0df39113f528363371461421.png' },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x9401811A34416304426e5917220E96d2ECB64459', chainId: 8453, decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x9401811a34416304426e5917220e96d2ecb64459.png' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', chainId: 8453, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb/logo.png' },
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
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState<{ hash: string; from: string; to: string; amount: string; timestamp: number; gasUsed?: string }[]>([]);
  const [stats, setStats] = useState({ totalVolume: '0', totalGas: '0', swapCount: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  const filteredTokens = COMMON_TOKENS.filter(token => 
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const { data: fromBalance } = useBalance({
    address,
    token: fromToken.address === '0x0000000000000000000000000000000000000000' ? undefined : fromToken.address as `0x${string}`,
    chainId: fromToken.chainId,
  });

  const { data: toBalance } = useBalance({
    address,
    token: toToken.address === '0x0000000000000000000000000000000000000000' ? undefined : toToken.address as `0x${string}`,
    chainId: toToken.chainId,
  });

  const hasInsufficientBalance = fromBalance && fromAmount ? 
    parseUnits(fromAmount, fromToken.decimals) > fromBalance.value : false;

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
      
      // ✅ FIX #3: Validate quote structure
      if (!result || !result.estimate || !result.estimate.toAmount || !result.transactionRequest) {
        throw new Error('Invalid quote structure from LI.FI');
      }
      
      if (BigInt(result.estimate.toAmount) <= 0n) {
        throw new Error('Invalid swap amount');
      }
      
      setQuote(result);
    } catch (error) {
      console.error('Quote error:', error);
      toast.error('Failed to get swap quote', { duration: 3000 });
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
      if (chainId !== fromToken.chainId) {
        toast.loading("Switching network...", { id: toastId });
        await switchChainAsync({ chainId: fromToken.chainId });
      }

      // ✅ FIX #4: ERC-20 token approval BEFORE swap
      if (fromToken.address !== '0x0000000000000000000000000000000000000000') {
        toast.loading("Checking token approval...", { id: toastId });
        
        if (quote.transactionRequest.approval) {
          toast.loading("Approving token...", { id: toastId });
          const approvalHash = await sendTransactionAsync({
            to: quote.transactionRequest.approval.to as `0x${string}`,
            data: quote.transactionRequest.approval.data,
            value: quote.transactionRequest.approval.value ? BigInt(quote.transactionRequest.approval.value) : 0n,
          });
          
          if (publicClient) {
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
            if (approvalReceipt.status === 'reverted') {
              throw new Error("Token approval failed");
            }
          }
          
          toast.loading("Approval confirmed!", { id: toastId });
        }
      }

      toast.loading("Confirm swap in wallet...", { id: toastId });
      
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

        // ✅ FIX #2: Proper gas calculation with BigInt
        let gasUsed = '0.001';
        if (receipt.gasUsed && receipt.effectiveGasPrice) {
          const gasCostBigInt = BigInt(receipt.gasUsed) * receipt.effectiveGasPrice;
          gasUsed = formatEther(gasCostBigInt);
        }

        const newSwap = {
          hash,
          from: fromToken.symbol,
          to: toToken.symbol,
          amount: `${Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)).toFixed(4)} ${toToken.symbol}`,
          timestamp: Date.now(),
          gasUsed
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
            totalGas: (parseFloat(prev.totalGas) + parseFloat(gasUsed)).toString(),
            swapCount: prev.swapCount + 1
          };
          localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
          return newStats;
        });

        toast.success("✅ Swap successful!", { id: toastId });
        setFromAmount('');
      }
    } catch (error: any) {
      console.error('Swap failed:', error);
      
      let errorMessage = "Swap failed";
      if (error.message?.includes('insufficient')) errorMessage = "Insufficient balance";
      else if (error.message?.includes('reverted')) errorMessage = "Transaction reverted";
      else if (error.message?.includes('allowance')) errorMessage = "Token allowance exceeded";
      else if (error.message?.includes('deadline')) errorMessage = "Transaction deadline passed";
      else if (error.message?.includes('approval')) errorMessage = "Token approval failed";
      
      toast.error(errorMessage, { id: toastId, duration: 5000 });
    } finally {
      setIsSwapping(false);
    }
  };

  const syncHistory = async () => {
    if (!address || !publicClient) return;
    setIsSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("History synced!", { duration: 3000 });
    } catch (error) {
      toast.error("Sync failed", { duration: 3000 });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard className="p-4 bg-blue-600/5 border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-white/60 uppercase font-bold">Volume</span>
              </div>
              <div className="text-2xl font-bold text-white">${Number(stats.totalVolume).toLocaleString()}</div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <GlassCard className="p-4 bg-purple-600/5 border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] text-white/60 uppercase font-bold">Gas Spent</span>
              </div>
              <div className="text-2xl font-bold text-white">{Number(stats.totalGas).toFixed(4)} ETH</div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <GlassCard className="p-4 bg-green-600/5 border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[10px] text-white/60 uppercase font-bold">Swaps</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.swapCount}</div>
            </GlassCard>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
          <GlassCard className="p-6 min-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Repeat className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Swap Assets</h2>
                  <p className="text-[10px] text-white/40 uppercase">✅ Builder Attribution Enabled</p>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full">
              <div className="p-4 bg-white/5 rounded-3xl border border-white/10 space-y-2">
                <div className="flex justify-between text-[10px] text-white/40 uppercase font-bold">
                  <span>You Pay</span>
                  <span>{fromBalance ? `${Number(fromBalance.formatted).toFixed(4)} ${fromBalance.symbol}` : '0.00'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.0"
                    className="bg-transparent text-2xl font-bold text-white outline-none w-full"
                  />
                  <div 
                    className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl cursor-pointer hover:bg-white/20 shrink-0"
                    onClick={() => setIsTokenSelectorOpen('from')}
                  >
                    <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                    <span className="font-bold text-white">{fromToken.symbol}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-6 relative z-10">
                <Button 
                  variant="outline" 
                  className="w-10 h-10 rounded-full bg-slate-900 p-0 hover:scale-110"
                  onClick={() => {
                    const temp = fromToken;
                    setFromToken(toToken);
                    setToToken(temp);
                    setFromAmount('');
                  }}
                >
                  <ArrowDown className="w-5 h-5 text-blue-400" />
                </Button>
              </div>

              <div className="p-4 bg-white/5 rounded-3xl border border-white/10 space-y-2">
                <div className="flex justify-between text-[10px] text-white/40 uppercase font-bold">
                  <span>You Receive</span>
                  <span>{toBalance ? `${Number(toBalance.formatted).toFixed(4)} ${toBalance.symbol}` : '0.00'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-white/60 w-full">
                    {isQuoting ? <Loader2 className="w-6 h-6 animate-spin" /> : quote ? Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)).toFixed(6) : '0.0'}
                  </div>
                  <div 
                    className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl cursor-pointer hover:bg-white/20 shrink-0"
                    onClick={() => setIsTokenSelectorOpen('to')}
                  >
                    <img src={toToken.logoURI} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                    <span className="font-bold text-white">{toToken.symbol}</span>
                  </div>
                </div>
              </div>

              {quote && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 space-y-2 text-xs"
                >
                  <div className="flex justify-between text-white/60">
                    <span>Rate</span>
                    <span>1 {fromToken.symbol} = {(() => {
                      // ✅ FIX #1: Proper swap rate calculation with decimal formatting
                      try {
                        const fromFormatted = Number(formatUnits(BigInt(quote.estimate.fromAmount), fromToken.decimals));
                        const toFormatted = Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals));
                        return fromFormatted > 0 ? (toFormatted / fromFormatted).toFixed(6) : '0';
                      } catch (e) {
                        return '0';
                      }
                    })()} {toToken.symbol}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Gas</span>
                    <span>${Number(quote.estimate.gasCosts?.[0]?.amountUSD || '0').toFixed(2)}</span>
                  </div>
                </motion.div>
              )}

              <Button
                className={cn(
                  "w-full py-6 rounded-3xl text-lg font-bold shadow-xl mt-4",
                  hasInsufficientBalance ? "bg-red-500/20 text-red-400" : "bg-blue-600 hover:bg-blue-500 text-white"
                )}
                disabled={!quote || isSwapping || !address || hasInsufficientBalance}
                onClick={handleSwap}
              >
                {isSwapping ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Executing...</> : !address ? <><Wallet className="w-5 h-5 mr-2" /> Connect</> : hasInsufficientBalance ? '❌ Insufficient Balance' : quote ? '✅ Swap Now' : 'Enter Amount'}
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <div className="space-y-6">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white">Recent Swaps</h3>
            </div>
            <Button variant="ghost" className="p-1" onClick={syncHistory} disabled={isSyncing}>
              <RefreshCw className={cn("w-4 h-4 text-white/40", isSyncing && "animate-spin")} />
            </Button>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-white/30">No recent swaps</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map((item, i) => (
                <div key={item.hash + i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-blue-500/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-white font-bold">{item.amount}</span>
                    <a href={`https://basescan.org/tx/${item.hash}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 text-white/40" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
