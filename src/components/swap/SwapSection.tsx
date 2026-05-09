import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Lock, Unlock, History, Activity, Search, X } from 'lucide-react';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  // Core State
  const [tokens, setTokens] = useState<any[]>([]);
  const [fromToken, setFromToken] = useState<any>(null);
  const [toToken, setToToken] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  
  // Advanced Features State
  const [isAmountLocked, setIsAmountLocked] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  
  // UI State
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [selectingToken, setSelectingToken] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // History & Stats
  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`swap_stats_${address}`) || '{"totalVolume":0,"history":[]}'); } 
    catch { return { totalVolume: 0, history: [] }; }
  });

  // Fetch Full Token List from LI.FI
  useEffect(() => {
    const fetchAllTokens = async () => {
      try {
        const res = await fetch('https://li.quest/v1/tokens?chains=base');
        const data = await res.json();
        const baseTokens = data.tokens[8453] || [];
        setTokens(baseTokens);
        if (baseTokens.length > 0) {
          setFromToken(baseTokens.find((t:any) => t.symbol === 'ETH') || baseTokens[0]);
          setToToken(baseTokens.find((t:any) => t.symbol === 'USDC') || baseTokens[1]);
        }
      } catch (err) {
        console.error("Failed to load tokens");
      }
    };
    fetchAllTokens();
  }, []);

  const { data: fromBalance, refetch: refetchFromBalance } = useBalance({
    address, token: fromToken?.address === NATIVE_TOKEN_ADDRESS ? undefined : fromToken?.address as Address,
  });
  const { refetch: refetchToBalance } = useBalance({
    address, token: toToken?.address === NATIVE_TOKEN_ADDRESS ? undefined : toToken?.address as Address,
  });

  // Quote Fetcher
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address || !fromToken || !toToken) return setQuote(null);
      setIsFetchingQuote(true);
      try {
        const parsedAmount = parseUnits(amount, fromToken.decimals).toString();
        const response = await fetch(`https://li.quest/v1/quote?fromChain=8453&toChain=8453&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}&slippage=${parseFloat(slippage) / 100}`);
        const data = await response.json();
        setQuote(data.transactionRequest ? data : null);
      } catch {
        setQuote(null);
      } finally {
        setIsFetchingQuote(false);
      }
    };
    const timeoutId = setTimeout(fetchQuote, 400);
    return () => clearTimeout(timeoutId);
  }, [amount, fromToken, toToken, address, slippage]);

  const handlePercentage = (percent: number) => {
    if (!fromBalance) return;
    const total = Number(fromBalance.formatted);
    // Leave a tiny bit of ETH for gas if maxing out native token
    const val = (percent === 100 && fromToken.address === NATIVE_TOKEN_ADDRESS) ? Math.max(0, total - 0.002) : total * (percent / 100);
    setAmount(val.toFixed(6).replace(/\.?0+$/, ''));
  };

  const handleSwap = async () => {
    if (!quote || !address || !publicClient) return toast.error('Wait for a valid route');
    setIsSwapping(true);
    const toastId = toast.loading('Initializing swap…');

    try {
      if (chainId !== 8453) {
        toast.loading(`Switching to Base…`, { id: toastId });
        await switchChainAsync({ chainId: 8453 });
      }

      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData = hasBuilderCode(rawData) ? rawData : appendBuilderCode(rawData);

      if (fromToken.address !== NATIVE_TOKEN_ADDRESS) {
        toast.loading('Checking allowance…', { id: toastId });
        const allowance = await publicClient.readContract({ address: fromToken.address as Address, abi: erc20Abi, functionName: 'allowance', args: [address, quote.estimate.approvalAddress as Address] });
        if (allowance < BigInt(quote.estimate.fromAmount)) {
          toast.loading('Approve token in wallet…', { id: toastId });
          const approveHash = await writeContractAsync({ address: fromToken.address as Address, abi: erc20Abi, functionName: 'approve', args: [quote.estimate.approvalAddress as Address, BigInt(quote.estimate.fromAmount)] });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      toast.loading('Confirm swap in wallet…', { id: toastId });
      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as Address,
        data: finalData,
        value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      });

      toast.loading('Processing on Base…', { id: toastId });
      await publicClient.waitForTransactionReceipt({ hash });

      await Promise.all([refetchFromBalance(), refetchToBalance()]);
      
      // Update Stats & History
      const usdValue = parseFloat(quote.estimate.fromAmountUSD || '0');
      const newHistory = [{ hash, from: fromToken.symbol, to: toToken.symbol, amt: amount, usd: usdValue, date: new Date().toISOString() }, ...stats.history].slice(0, 10);
      const newStats = { totalVolume: stats.totalVolume + usdValue, history: newHistory };
      setStats(newStats);
      localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));

      toast.success('Swap completed successfully!', { id: toastId });
      if (!isAmountLocked) setAmount('');
    } catch (error: any) {
      toast.error(error.message?.includes('funds') ? "Insufficient Base ETH for gas." : "Swap failed or rejected.", { id: toastId });
    } finally {
      setIsSwapping(false);
    }
  };

  if (!fromToken || !toToken) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00F0FF]"></div></div>;

  const filteredTokens = tokens.filter(t => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.address.toLowerCase() === searchQuery.toLowerCase());

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Header & Settings */}
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-black text-white tracking-widest">NEXUS ROUTER</h2>
        <button onClick={() => setShowSettings(!showSettings)} className="text-zinc-400 hover:text-[#00F0FF] transition-colors"><Settings className="w-5 h-5" /></button>
      </div>

      {showSettings && (
        <GlassCard className="p-4 border-[#00F0FF]/30 bg-[#050b14]">
          <p className="text-xs font-bold text-zinc-400 mb-2 uppercase">Max Slippage</p>
          <div className="flex gap-2">
            {['0.1', '0.5', '1.0'].map(val => (
              <button key={val} onClick={() => setSlippage(val)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${slippage === val ? 'bg-[#00F0FF] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-700'}`}>{val}%</button>
            ))}
            <div className="relative flex-1">
              <input type="number" value={slippage} onChange={(e) => setSlippage(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 px-2 text-xs text-white outline-none focus:border-[#00F0FF]" placeholder="Custom" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-3 border-[#00F0FF]/20 shadow-2xl bg-[#0a1224]">
        {/* FROM BOX */}
        <div className="bg-[#050b14] p-4 rounded-2xl border border-zinc-800">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-zinc-400 font-bold uppercase">You Pay</span>
            <span className="text-zinc-500">Bal: {fromBalance ? Number(fromBalance.formatted).toFixed(4) : '0.00'}</span>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isAmountLocked} placeholder="0.0" className="bg-transparent text-3xl font-black text-white outline-none w-full disabled:opacity-50" />
            </div>
            <button onClick={() => setSelectingToken('from')} className="flex items-center gap-2 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 px-3 py-2 rounded-xl text-white font-bold border border-[#00F0FF]/30 shrink-0">
              <img src={fromToken.logoURI || fromToken.logo} className="w-6 h-6 rounded-full" /> {fromToken.symbol} <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex justify-between items-center mt-3">
            <div className="flex gap-1.5">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => handlePercentage(pct)} disabled={isAmountLocked} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-300 disabled:opacity-50">{pct === 100 ? 'MAX' : `${pct}%`}</button>
              ))}
            </div>
            <button onClick={() => setIsAmountLocked(!isAmountLocked)} className={`p-1.5 rounded-md transition-colors ${isAmountLocked ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {isAmountLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* SWAP ARROW */}
        <div className="relative h-2 flex justify-center items-center z-10 my-2">
          <button onClick={() => { setFromToken(toToken); setToToken(fromToken); }} className="bg-[#0a1224] p-2 rounded-xl border border-zinc-700 text-[#00F0FF] hover:rotate-180 transition-transform">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* TO BOX */}
        <div className="bg-[#050b14] p-4 rounded-2xl border border-zinc-800">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-zinc-400 font-bold uppercase">You Receive</span>
            <span className="text-zinc-500">Bal: {toToken.address === NATIVE_TOKEN_ADDRESS ? 'ETH' : 'Token'}</span>
          </div>
          <div className="flex gap-4 items-center">
            <input type="text" disabled value={quote ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals) : ''} placeholder={isFetchingQuote ? "Routing..." : "0.0"} className="bg-transparent text-3xl font-black text-zinc-500 outline-none w-full" />
            <button onClick={() => setSelectingToken('to')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl text-white font-bold border border-zinc-600 shrink-0">
              <img src={toToken.logoURI || toToken.logo} className="w-6 h-6 rounded-full" /> {toToken.symbol} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          {quote && <div className="text-[10px] text-[#00F0FF] mt-2 font-mono">≈ ${Number(quote.estimate.toAmountUSD).toFixed(2)} USD</div>}
        </div>

        <Button onClick={handleSwap} disabled={isSwapping || isFetchingQuote || !amount || !quote} className="w-full mt-4 py-5 text-lg font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-black hover:opacity-90">
          {isSwapping ? 'Executing Route...' : isFetchingQuote ? 'Finding Best Route...' : !amount ? 'Enter Amount' : 'Swap Now'}
        </Button>
      </GlassCard>

      {/* Stats & History Module */}
      <GlassCard className="p-4 bg-[#050b14] border-zinc-800">
        <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2 text-zinc-400"><Activity className="w-4 h-4 text-[#B026FF]"/> <span className="text-xs font-bold uppercase">Total Volume</span></div>
          <span className="text-sm font-black text-white">${stats.totalVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 mb-2"><History className="w-4 h-4 text-[#00F0FF]"/> <span className="text-xs font-bold uppercase">Recent Swaps</span></div>
        {stats.history.length === 0 ? <p className="text-xs text-zinc-600 italic">No swap history yet.</p> : (
          <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
            {stats.history.map((tx:any, i:number) => (
              <div key={i} className="flex justify-between items-center bg-[#0a1224] p-2 rounded-lg border border-zinc-800/50">
                <span className="text-xs text-white font-bold">{tx.amt} {tx.from} ➔ {tx.to}</span>
                <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-[10px] text-[#00F0FF] hover:underline">${tx.usd.toFixed(2)}</a>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Token Selector Modal */}
      <AnimatePresence>
        {selectingToken && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <GlassCard className="w-full max-w-sm p-4 bg-[#0a1224] border border-[#00F0FF]/30 h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-lg">Select Token</h3>
                <button onClick={() => setSelectingToken(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type="text" placeholder="Search name or paste 0x..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#050b14] border border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:border-[#00F0FF]/50 outline-none" />
              </div>
              <div className="overflow-y-auto space-y-1 flex-1 custom-scrollbar pr-2">
                {filteredTokens.map((token:any) => (
                  <button key={token.address} onClick={() => { selectingToken === 'from' ? setFromToken(token) : setToToken(token); setSelectingToken(null); setSearchQuery(''); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800 text-left group">
                    <img src={token.logoURI || token.logo} className="w-8 h-8 rounded-full border border-zinc-700" onError={(e) => { (e.target as any).src = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'; }} />
                    <div>
                      <div className="font-bold text-white group-hover:text-[#00F0FF]">{token.symbol}</div>
                      <div className="text-[10px] text-zinc-500">{token.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
