import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Route, Wallet, BarChart3, Search, X, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEFAULT_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png', chainId: 8453 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', chainId: 8453 },
  { symbol: 'USDbC', name: 'Bridged USDC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', chainId: 8453 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png', chainId: 8453 },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png', chainId: 8453 },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631.png', chainId: 8453 },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', decimals: 8, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf.png', chainId: 8453 },
  { symbol: 'BRETT', name: 'Brett', address: '0x532f27101965dd16442e59d40670faf5abe12269', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x532f27101965dd16442e59d40670faf5abe12269.png', chainId: 8453 }
];

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  
  // Custom Tokens State
  const [savedTokens, setSavedTokens] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('custom_tokens') || '[]'); } catch { return []; }
  });
  
  const [fromToken, setFromToken] = useState<any>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<any>(DEFAULT_TOKENS[1]);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  
  // Modal State
  const [selectingToken, setSelectingToken] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingContract, setIsSearchingContract] = useState(false);
  const [customTokenResult, setCustomTokenResult] = useState<any>(null);
  const [slippage, setSlippage] = useState('0.5');

  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`swap_stats_${address}`) || '{"totalVolume":"0","swapCount":0}'); } 
    catch { return { totalVolume: '0', swapCount: 0 }; }
  });

  const { data: fromBalance, refetch: refetchFromBalance } = useBalance({
    address,
    token: fromToken.address === NATIVE_TOKEN_ADDRESS ? undefined : fromToken.address as Address,
  });

  const { refetch: refetchToBalance } = useBalance({
    address,
    token: toToken.address === NATIVE_TOKEN_ADDRESS ? undefined : toToken.address as Address,
  });

  // Fetch LI.FI Quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address) {
        setQuote(null);
        return;
      }
      setIsFetchingQuote(true);
      try {
        const parsedAmount = parseUnits(amount, fromToken.decimals).toString();
        const response = await fetch(
          `https://li.quest/v1/quote?fromChain=${fromToken.chainId}&toChain=${toToken.chainId}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}&slippage=${parseFloat(slippage) / 100}`
        );
        const data = await response.json();
        if (data.transactionRequest) setQuote(data);
        else setQuote(null);
      } catch (error) {
        setQuote(null);
      } finally {
        setIsFetchingQuote(false);
      }
    };
    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [amount, fromToken, toToken, address, slippage]);

  // Handle Custom Token Search via LI.FI
  useEffect(() => {
    const searchCustomToken = async () => {
      if (searchQuery.startsWith('0x') && searchQuery.length === 42) {
        setIsSearchingContract(true);
        try {
          const res = await fetch(`https://li.quest/v1/token?chain=base&token=${searchQuery}`);
          const data = await res.json();
          if (data.symbol) {
            setCustomTokenResult({
              symbol: data.symbol,
              name: data.name,
              address: data.address,
              decimals: data.decimals,
              logo: data.logoURI || 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
              chainId: 8453
            });
          }
        } catch {
          setCustomTokenResult(null);
        } finally {
          setIsSearchingContract(false);
        }
      } else {
        setCustomTokenResult(null);
      }
    };
    const timeoutId = setTimeout(searchCustomToken, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSwap = async () => {
    if (!quote || !address || !publicClient) return toast.error('Wait for a valid route');
    setIsSwapping(true);
    const toastId = toast.loading('Initializing swap…');

    try {
      if (chainId !== fromToken.chainId) {
        toast.loading(`Switching to Base…`, { id: toastId });
        await switchChainAsync({ chainId: fromToken.chainId });
      }

      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData = hasBuilderCode(rawData) ? rawData : appendBuilderCode(rawData);

      const isNative = fromToken.address === NATIVE_TOKEN_ADDRESS;
      if (!isNative) {
        toast.loading('Checking allowance…', { id: toastId });
        const spender = quote.estimate.approvalAddress as Address;
        const allowance = await publicClient.readContract({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, spender],
        });

        const requiredAmount = BigInt(quote.estimate.fromAmount);
        if (allowance < requiredAmount) {
          toast.loading('Approve token in wallet…', { id: toastId });
          const approveHash = await writeContractAsync({
            address: fromToken.address as Address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, requiredAmount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      toast.loading('Confirm swap in wallet…', { id: toastId });
      const txValue = quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n;
      
      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: txValue,
        gas: BigInt(quote.transactionRequest.gasLimit || 600000),
      });

      toast.loading('Broadcasting to network…', { id: toastId });
      await publicClient.waitForTransactionReceipt({ hash });

      // Refresh balances immediately!
      await Promise.all([refetchFromBalance(), refetchToBalance()]);

      setStats((prev: any) => {
        const usdValue = parseFloat(quote.estimate.toAmountUSD ?? '0');
        const newStats = { totalVolume: (parseFloat(prev.totalVolume) + usdValue).toFixed(2), swapCount: prev.swapCount + 1 };
        localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));
        return newStats;
      });

      toast.success('Swap completed successfully!', { id: toastId });
      setAmount('');
    } catch (error: any) {
      let msg = error.message?.includes('User rejected') ? "Cancelled in wallet" : "Swap failed.";
      if (error.message?.toLowerCase().includes('insufficient funds')) msg = "Insufficient Base ETH for gas fees.";
      toast.error(msg, { id: toastId });
    } finally {
      setIsSwapping(false);
    }
  };

  const allTokens = [...DEFAULT_TOKENS, ...savedTokens];
  const filteredTokens = allTokens.filter(t => 
    t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.address.toLowerCase() === searchQuery.toLowerCase()
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Stats Header */}
      <GlassCard className="p-4 flex justify-between items-center bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-white/5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Your Volume</p>
            <p className="text-sm font-bold text-white">${Number(stats.totalVolume).toLocaleString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Total Swaps</p>
          <p className="text-sm font-bold text-white">{stats.swapCount}</p>
        </div>
      </GlassCard>

      {/* Main Interface */}
      <GlassCard className="p-2 overflow-hidden border-white/10 shadow-2xl">
        <div className="flex justify-between items-center px-4 pt-3 pb-2">
          <h2 className="text-lg font-bold text-white">Swap</h2>
          <div className="flex gap-2">
            <select value={slippage} onChange={(e) => setSlippage(e.target.value)} className="bg-white/5 text-white/60 text-xs px-2 py-1 rounded-lg outline-none border border-white/10">
              <option value="0.1">0.1%</option>
              <option value="0.5">0.5%</option>
              <option value="1.0">1.0%</option>
            </select>
          </div>
        </div>

        {/* FROM BLOCK */}
        <div className="bg-black/30 p-4 rounded-2xl m-1 border border-white/5 transition-all focus-within:border-blue-500/30">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-white/50 font-medium">You Pay</span>
            <span className="text-white/50 flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setAmount(fromBalance?.formatted || '')}>
              <Wallet className="w-3 h-3" /> {fromBalance ? Number(fromBalance.formatted).toFixed(5) : '0.00'}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <input type="number" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-4xl font-black text-white outline-none w-full placeholder:text-white/20" />
            <button onClick={() => setSelectingToken('from')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-all shrink-0 shadow-sm">
              <img src={fromToken.logo} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
              <span className="font-bold text-white text-lg">{fromToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/60" />
            </button>
          </div>
          {quote && <div className="text-[10px] text-white/40 mt-2">${parseFloat(quote.estimate.fromAmountUSD).toFixed(2)}</div>}
        </div>

        {/* SWITCH BUTTON */}
        <div className="relative h-2 flex justify-center items-center z-10 my-1">
          <button onClick={() => { setFromToken(toToken); setToToken(fromToken); setAmount(''); setQuote(null); }} className="bg-[#1a2336] p-2 rounded-xl border-4 border-[#0a101d] text-white hover:text-blue-400 hover:rotate-180 transition-all duration-300">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* TO BLOCK */}
        <div className="bg-black/30 p-4 rounded-2xl m-1 border border-white/5">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-white/50 font-medium">You Receive</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <input type="text" disabled value={quote ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals) : ''} placeholder={isFetchingQuote ? "Finding best route..." : "0.0"} className="bg-transparent text-4xl font-black text-white/50 outline-none w-full" />
            <button onClick={() => setSelectingToken('to')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-all shrink-0 shadow-sm">
              <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
              <span className="font-bold text-white text-lg">{toToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/60" />
            </button>
          </div>
          {quote && <div className="text-[10px] text-white/40 mt-2">${parseFloat(quote.estimate.toAmountUSD).toFixed(2)}</div>}
        </div>

        {/* ROUTING INFO */}
        <AnimatePresence>
          {quote && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 py-3 bg-blue-900/10 rounded-xl m-1 border border-blue-500/20 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/50 flex items-center gap-1.5"><Route className="w-3 h-3" /> Route</span>
                <span className="text-blue-400 font-bold">via LI.FI</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Est. Network Fee</span>
                <span className="text-white/80">${parseFloat(quote.estimate.gasCosts?.[0]?.amountUSD || '0').toFixed(2)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-1 mt-2">
          <Button onClick={handleSwap} disabled={isSwapping || isFetchingQuote || !amount} className="w-full py-5 text-lg font-bold rounded-xl shadow-lg shadow-blue-500/20">
            {isSwapping ? 'Swapping...' : isFetchingQuote ? 'Fetching Route...' : !amount ? 'Enter Amount' : 'Review Swap'}
          </Button>
        </div>
      </GlassCard>

      {/* Token Search Modal */}
      <AnimatePresence>
        {selectingToken && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <GlassCard className="w-full max-w-sm p-4 flex flex-col h-[600px] max-h-[80vh] bg-[#0a1224] border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white">Select Token</h3>
                <button onClick={() => { setSelectingToken(null); setSearchQuery(''); setCustomTokenResult(null); }} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="text" 
                  placeholder="Search name or paste 0x address..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:border-blue-500/50" 
                />
              </div>

              <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                {/* Show Native/Saved Tokens */}
                {!isSearchingContract && !customTokenResult && filteredTokens.map(token => (
                  <button 
                    key={token.address}
                    onClick={() => {
                      if (selectingToken === 'from') setFromToken(token); else setToToken(token);
                      setSelectingToken(null); setSearchQuery('');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img src={token.logo} className="w-8 h-8 rounded-full border border-white/5 shadow-sm" />
                      <div>
                        <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{token.symbol}</div>
                        <div className="text-[10px] text-white/40">{token.name}</div>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Loading State for Contract Search */}
                {isSearchingContract && (
                  <div className="flex flex-col items-center justify-center py-10 text-white/40 text-sm gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Searching Base network...
                  </div>
                )}

                {/* Show Custom Token Found via Contract Address */}
                {customTokenResult && !isSearchingContract && (
                  <button 
                    onClick={() => {
                      const newTokens = [...savedTokens, customTokenResult];
                      setSavedTokens(newTokens);
                      localStorage.setItem('custom_tokens', JSON.stringify(newTokens));
                      if (selectingToken === 'from') setFromToken(customTokenResult); else setToToken(customTokenResult);
                      setSelectingToken(null); setSearchQuery(''); setCustomTokenResult(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-900/20 border border-blue-500/30 hover:bg-blue-900/40 transition-all text-left group mt-2"
                  >
                    <div className="flex items-center gap-3">
                      <img src={customTokenResult.logo} className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {customTokenResult.symbol}
                          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">New</span>
                        </div>
                        <div className="text-[10px] text-white/40 truncate w-32">{customTokenResult.address}</div>
                      </div>
                    </div>
                    <PlusCircle className="w-5 h-5 text-blue-400" />
                  </button>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
