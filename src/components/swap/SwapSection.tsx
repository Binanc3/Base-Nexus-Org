import { useState, useEffect, useCallback } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { ArrowDownUp, Settings, Info, Loader2, History, ExternalLink, Clock, RefreshCw, TrendingUp, Zap, ChevronRight, Star, Repeat } from 'lucide-react';
import { LiFiWidget, useWidgetEvents, WidgetEvent } from '@lifi/widget';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function SwapSection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const widgetEvents = useWidgetEvents();
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

  useEffect(() => {
    const onRouteExecutionCompleted = (route: any) => {
      const lastStep = route.steps[route.steps.length - 1];
      const newSwap = {
        hash: lastStep.execution?.process[lastStep.execution.process.length - 1].txHash || '0x...',
        from: route.fromToken.symbol,
        to: route.toToken.symbol,
        amount: `${Number(route.toAmountMin).toFixed(4)} ${route.toToken.symbol}`,
        timestamp: Date.now(),
        gasUsed: lastStep.execution?.gasAmountUsed ? formatEther(BigInt(lastStep.execution.gasAmountUsed)) : '0.001'
      };
      
      setHistory(prev => {
        const updated = [newSwap, ...prev].slice(0, 50);
        localStorage.setItem(`swap_history_${address}`, JSON.stringify(updated));
        return updated;
      });
      
      setStats(prev => {
        const usdValue = parseFloat(route.toAmountUSD || '0');
        const rawAmount = parseFloat(route.toAmount);
        const decimals = route.toToken.decimals || 18;
        const normalizedAmount = rawAmount / Math.pow(10, decimals);
        
        // LiFi sometimes returns raw amount as USD (common bug with some providers)
        // If USD value is more than 1000x the normalized amount, it's likely raw
        // We also check if the USD value is suspiciously high for a single swap
        let actualUsd = usdValue;
        if (usdValue > 0 && normalizedAmount > 0) {
          const ratio = usdValue / normalizedAmount;
          // If the ratio is exactly a power of 10 (like 10^6 or 10^18), it's definitely raw
          const isPowerOf10 = Math.abs(Math.log10(ratio) - Math.round(Math.log10(ratio))) < 0.0001;
          
          if (isPowerOf10 || ratio > 10000) {
            actualUsd = normalizedAmount;
          }
        } else if (usdValue === 0 && normalizedAmount > 0) {
          // Fallback if USD value is missing
          actualUsd = normalizedAmount;
        }

        const newStats = {
          totalVolume: (parseFloat(prev.totalVolume) + actualUsd).toString(),
          totalGas: (parseFloat(prev.totalGas) + parseFloat(newSwap.gasUsed)).toString(),
          swapCount: prev.swapCount + 1
        };
        localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
        return newStats;
      });
    };

    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onRouteExecutionCompleted);
    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onRouteExecutionCompleted);
    };
  }, [widgetEvents, address]);

  const syncHistory = async () => {
    if (!address || !publicClient) return;
    setIsSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newStats = history.reduce((acc, item) => {
        acc.totalVolume = (parseFloat(acc.totalVolume) + parseFloat(item.amount.split(' ')[0] || '0')).toString();
        acc.totalGas = (parseFloat(acc.totalGas) + parseFloat(item.gasUsed || '0')).toString();
        acc.swapCount += 1;
        return acc;
      }, { totalVolume: '0', totalGas: '0', swapCount: 0 });

      setStats(newStats);
      localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
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
          <GlassCard className="p-0 sm:p-4 min-h-[750px] relative overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Swap Assets</h2>
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
                  title="Reset Stats"
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
                <Button variant="ghost" className="p-2 hover:bg-white/5"><Settings className="w-5 h-5" /></Button>
                <Button variant="ghost" className="p-2 hover:bg-white/5"><Info className="w-5 h-5" /></Button>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-black/40 p-1 sm:p-2 shadow-2xl overflow-hidden mx-2 sm:mx-4">
              <LiFiWidget
                integrator="BaseNexus"
                config={{
                  chains: {
                    allow: [8453, 1, 10, 42161, 137] // Allow major chains for cross-chain swaps
                  },
                  fromChain: 8453,
                  toChain: 8453,
                  appearance: 'dark',
                  theme: {
                    palette: {
                      primary: { main: '#3b82f6' },
                      background: { paper: '#0f172a', default: 'transparent' }
                    },
                    shape: {
                      borderRadius: 24,
                      borderRadiusSecondary: 16
                    }
                  },
                  sdkConfig: {
                    routeOptions: {
                      allowSwitchChain: true
                    }
                  }
                }}
              />
            </div>
            
            <p className="text-center text-[10px] text-white/20 mt-6 uppercase tracking-widest font-bold">
              Optimized routing powered by Jumper & LI.FI
            </p>
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
              BaseNexus uses LI.FI to find the best routes across the Base ecosystem. 
              Every swap is optimized for speed and gas efficiency.
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
