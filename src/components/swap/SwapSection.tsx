import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Lock, Unlock, History, Activity, Search, X, Zap, Clock, Fuel, ShieldAlert } from 'lucide-react';
import { appendBuilderCode } from '../../lib/wagmi';
import { supabase } from '@/src/supabase'; // <-- Connected to Supabase for accurate volume

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

const CHAINS = [
  { id: 8453, name: 'Base', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg' }
];

const TOP_BASE_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png', chainId: 8453 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', chainId: 8453 },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', decimals: 8, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf.png', chainId: 8453 },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631.png', chainId: 8453 },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png', chainId: 8453 },
  { symbol: 'BRETT', name: 'Brett', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x532f27101965dd16442e59d40670faf5ebb142e4.png', chainId: 8453 },
  { symbol: 'VIRTUAL', name: 'Virtual Protocol', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b.png', chainId: 8453 },
  { symbol: 'HIGHER', name: 'Higher', address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0578d8a44db98b23bf096a382e016e29a5ce0ffe.png', chainId: 8453 }
];

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [fromChain, setFromChain] = useState(CHAINS[0]);
  const [toChain, setToChain] = useState(CHAINS[0]);

  const [tokens] = useState<any[]>(TOP_BASE_TOKENS);
  const [fromToken, setFromToken] = useState<any>(TOP_BASE_TOKENS[0]);
  const [toToken, setToToken] = useState<any>(TOP_BASE_TOKENS[1]);
  const [amount, setAmount] = useState('');
  
  const [quote, setQuote] = useState<any>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  const [isAmountLocked, setIsAmountLocked] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  const [selectingToken, setSelectingToken] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 100% Accurate Supabase Volume Tracking
  const [stats, setStats] = useState({ totalVolume: 0, history: [] as any[] });

  const fetchAccurateHistory = async () => {
    if (!address) return;
    try {
      const { data, error } = await supabase.from('user_swaps').select('*').eq('user_address', address).order('created_at', { ascending: false });
      if (!error && data) {
        const total = data.reduce((sum, tx) => sum + Number(tx.usd_value || 0), 0);
        setStats({ totalVolume: total, history: data });
      }
    } catch (err) { console.error("Database sync failed", err); }
  };

  useEffect(() => { fetchAccurateHistory(); }, [address]);

  const { data: fromBalance, refetch: refetchFromBalance } = useBalance({ address, token: fromToken?.address === NATIVE_TOKEN_ADDRESS ? undefined : fromToken?.address as Address, chainId: fromChain.id });
  const { refetch: refetchToBalance } = useBalance({ address, token: toToken?.address === NATIVE_TOKEN_ADDRESS ? undefined : toToken?.address as Address, chainId: toChain.id });

  // Jumper Quote Engine Fetching
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address) return setQuote(null);
      setIsFetchingQuote(true);
      try {
        let parsedAmount;
        try { parsedAmount = parseUnits(amount, fromToken.decimals).toString(); } 
        catch (e) { setQuote(null); setIsFetchingQuote(false); return; }

        const safeSlippage = parseFloat(slippage) > 0 ? parseFloat(slippage) / 100 : 0.005;
        const response = await fetch(`https://li.quest/v1/quote?fromChain=${fromChain.id}&toChain=${toChain.id}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}&slippage=${safeSlippage}`);
        
        if (!response.ok) throw new Error("Route unavailable");
        const data = await response.json();
        setQuote(data?.transactionRequest ? data : null);
      } catch { 
        setQuote(null); 
      } finally { 
        setIsFetchingQuote(false); 
      }
    };
    const tId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(tId);
  }, [amount, fromToken, toToken, address, slippage, fromChain.id, toChain.id]);

  const handlePercentage = (percent: number) => {
    if (!fromBalance?.formatted) return;
    const total = Number(fromBalance.formatted);
    if (isNaN(total)) return;
    const val = (percent === 100 && fromToken.address === NATIVE_TOKEN_ADDRESS) ? Math.max(0, total - 0.0015) : total * (percent / 100);
    setAmount(val.toFixed(6).replace(/\.?0+$/, ''));
  };

  const handleSwap = async () => {
    if (!quote?.transactionRequest?.to || !address || !publicClient) return toast.error('Wait for a valid route');
    setIsSwapping(true);
    const toastId = toast.loading('Initializing Swap…');

    try {
      if (chainId !== fromChain.id) await switchChainAsync({ chainId: fromChain.id });

      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      
      // BUILDER CODE INJECTION
      let finalData = rawData;
      try { finalData = appendBuilderCode(rawData) as `0x${string}`; } catch(e) { console.warn("Builder code skip", e); }

      // APPROVAL
      if (fromToken.address !== NATIVE_TOKEN_ADDRESS) {
        toast.loading('Checking allowance…', { id: toastId });
        const approvalAddr = quote.estimate?.approvalAddress || quote.transactionRequest.to;
        const allowance = await publicClient.readContract({ address: fromToken.address as Address, abi: erc20Abi, functionName: 'allowance', args: [address, approvalAddr as Address] });
        if (allowance < BigInt(quote.estimate.fromAmount)) {
          toast.loading('Approve token…', { id: toastId });
          const tx = await writeContractAsync({ address: fromToken.address as Address, abi: erc20Abi, functionName: 'approve', args: [approvalAddr as Address, BigInt(quote.estimate.fromAmount)] });
          await publicClient.waitForTransactionReceipt({ hash: tx });
        }
      }

      // EXECUTION
      toast.loading('Confirming transaction…', { id: toastId });
      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as Address,
        data: finalData,
        value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      });

      toast.loading('Processing onchain…', { id: toastId });
      await publicClient.waitForTransactionReceipt({ hash });

      await Promise.all([refetchFromBalance(), refetchToBalance()]);
      
      // PERMANENT DATABASE LOGGING
      const usdValue = parseFloat(quote.estimate?.fromAmountUSD || '0');
      await supabase.from('user_swaps').insert({
        user_address: address,
        tx_hash: hash,
        from_token: fromToken.symbol,
        to_token: toToken.symbol,
        amount: amount,
        usd_value: usdValue
      });
      
      await fetchAccurateHistory(); // Refresh accuracy

      toast.success('Transaction Successful!', { id: toastId });
      if (!isAmountLocked) setAmount('');
    } catch (error: any) {
      toast.error(error.message?.includes('funds') ? "Insufficient funds for gas." : "Transaction failed.", { id: toastId });
    } finally { setIsSwapping(false); }
  };

  const safeSearch = (searchQuery || '').toLowerCase().trim();
  const filteredTokens = tokens.filter(t => {
    const symbol = (t.symbol || '').toLowerCase();
    const name = (t.name || '').toLowerCase();
    const tAddr = (t.address || '').toLowerCase();
    return symbol.includes(safeSearch) || name.includes(safeSearch) || tAddr === safeSearch;
  });

  const fromUsd = parseFloat(quote?.estimate?.fromAmountUSD || '0');
  const toUsd = parseFloat(quote?.estimate?.toAmountUSD || '0');
  const priceImpact = fromUsd > 0 ? ((fromUsd - toUsd) / fromUsd) * 100 : 0;
  const gasCostUsd = parseFloat(quote?.estimate?.gasCosts?.[0]?.amountUSD || '0');

  return (
    <div className="w-full max-w-[480px] mx-auto space-y-4">
      
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-black text-white tracking-widest flex items-center gap-2">
          <Route className="w-5 h-5 text-[#B026FF]" /> EXCHANGE
        </h2>
        <div className="flex gap-3">
          <button onClick={() => setShowSettings(!showSettings)} className="text-zinc-400 hover:text-[#00F0FF] transition-colors"><Settings className="w-5 h-5" /></button>
        </div>
      </div>

      {showSettings && (
        <GlassCard className="p-4 border-[#00F0FF]/30 bg-[#050b14]">
          <p className="text-xs font-bold text-zinc-400 mb-2 uppercase">Max Slippage Tolerence</p>
          <div className="flex gap-2">
            {['0.1', '0.5', '1.0'].map(val => (
              <button key={val} onClick={() => setSlippage(val)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${slippage === val ? 'bg-[#00F0FF] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-700'}`}>{val}%</button>
            ))}
            <input type="number" value={slippage} onChange={(e) => setSlippage(e.target.value)} className="w-24 bg-zinc-900 border border-zinc-700 rounded-xl px-2 text-xs text-white outline-none focus:border-[#00F0FF]" placeholder="Custom %" />
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-2 border-zinc-800 shadow-2xl bg-[#0a1224] rounded-3xl">
        
        {/* FROM */}
        <div className="bg-[#050b14] p-4 rounded-[22px] border border-zinc-800/50 hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-zinc-500 uppercase">From</span>
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800 cursor-not-allowed">
              <img src={fromChain.logo} className="w-3.5 h-3.5" />
              <span className="text-[10px] text-zinc-300 font-bold">{fromChain.name}</span>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isAmountLocked} placeholder="0" className="bg-transparent text-4xl font-black text-white outline-none w-full disabled:opacity-50" />
            <button onClick={() => setSelectingToken('from')} className="flex items-center gap-2 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 px-3 py-2 rounded-2xl text-white font-bold border border-[#00F0FF]/30 shrink-0 shadow-lg">
              <img src={fromToken?.logoURI} className="w-6 h-6 rounded-full bg-zinc-900" /> 
              <span className="text-lg">{fromToken?.symbol || 'ETH'}</span>
              <ChevronDown className="w-4 h-4 text-[#00F0FF]" />
            </button>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-1.5">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => handlePercentage(pct)} disabled={isAmountLocked} className="px-2.5 py-1 bg-zinc-800/50 hover:bg-zinc-700 rounded-md text-[10px] font-bold text-zinc-400">{pct === 100 ? 'MAX' : `${pct}%`}</button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-mono">Bal: {fromBalance?.formatted ? Number(fromBalance.formatted).toFixed(4) : '0.00'}</span>
              <button onClick={() => setIsAmountLocked(!isAmountLocked)} className={`p-1.5 rounded-md transition-colors ${isAmountLocked ? 'bg-[#FF003C]/20 text-[#FF003C]' : 'text-zinc-500 hover:text-white'}`}>
                {isAmountLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="relative h-1 flex justify-center items-center z-10 my-1">
          <button onClick={() => { setFromToken(toToken); setToToken(fromToken); setFromChain(toChain); setToChain(fromChain); }} className="bg-[#0a1224] p-2.5 rounded-xl border-4 border-[#0a1224] bg-zinc-800 text-white hover:text-[#00F0FF] hover:rotate-180 transition-transform">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* TO */}
        <div className="bg-[#050b14] p-4 rounded-[22px] border border-zinc-800/50 hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-zinc-500 uppercase">To</span>
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800 cursor-not-allowed">
              <img src={toChain.logo} className="w-3.5 h-3.5" />
              <span className="text-[10px] text-zinc-300 font-bold">{toChain.name}</span>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            {isFetchingQuote ? (
              <div className="w-full flex items-center h-[40px]">
                <div className="h-6 w-32 bg-zinc-800 animate-pulse rounded-md"></div>
              </div>
            ) : (
              <input type="text" disabled value={quote?.estimate?.toAmount ? formatUnits(BigInt(quote.estimate.toAmount), toToken?.decimals || 18) : ''} placeholder="0" className="bg-transparent text-4xl font-black text-zinc-300 outline-none w-full" />
            )}
            <button onClick={() => setSelectingToken('to')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-2xl text-white font-bold border border-zinc-600 shrink-0 shadow-lg">
              <img src={toToken?.logoURI} className="w-6 h-6 rounded-full bg-zinc-900" /> 
              <span className="text-lg">{toToken?.symbol || 'USDC'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <span className="text-xs text-zinc-500 font-mono">Bal: {refetchToBalance && 'Syncing...'}</span>
            {quote?.estimate?.toAmountUSD && (
              <span className="text-sm font-bold text-zinc-400">≈ ${Number(quote.estimate.toAmountUSD).toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* JUMPER ROUTE DETAILS */}
        {quote && !isFetchingQuote && (
          <div className="mt-3 p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400"/> Best Route</span>
              <div className="flex items-center gap-1 bg-[#00F0FF]/10 text-[#00F0FF] px-2 py-0.5 rounded text-[10px] font-bold">
                {quote.toolDetails?.name || 'DEX Router'}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="flex flex-col items-center bg-zinc-900 p-2 rounded-xl border border-zinc-800/50">
                <Fuel className="w-4 h-4 text-zinc-500 mb-1" />
                <span className="font-bold text-zinc-300">${gasCostUsd.toFixed(2)}</span>
              </div>
              <div className="flex flex-col items-center bg-zinc-900 p-2 rounded-xl border border-zinc-800/50">
                <Clock className="w-4 h-4 text-zinc-500 mb-1" />
                <span className="font-bold text-zinc-300">~{Math.ceil((quote.estimate.executionDuration || 30) / 60)} min</span>
              </div>
              <div className="flex flex-col items-center bg-zinc-900 p-2 rounded-xl border border-zinc-800/50">
                <ShieldAlert className={`w-4 h-4 mb-1 ${priceImpact > 5 ? 'text-[#FF003C]' : priceImpact > 1 ? 'text-yellow-400' : 'text-[#00FF00]'}`} />
                <span className={`font-bold ${priceImpact > 5 ? 'text-[#FF003C]' : 'text-zinc-300'}`}>{priceImpact.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSwap} disabled={isSwapping || isFetchingQuote || !amount || !quote} className="w-full mt-3 py-5 text-xl font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-white shadow-lg hover:opacity-90 rounded-2xl">
          {isSwapping ? 'Executing Route...' : isFetchingQuote ? 'Finding Best Route...' : !amount ? 'Enter Amount' : 'Review Swap'}
        </Button>
      </GlassCard>

      {/* Accurate History Widget */}
      <div className="px-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1"><History className="w-3.5 h-3.5"/> Recent Activity</span>
          <span className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1"><Activity className="w-3.5 h-3.5"/> Vol: ${(stats?.totalVolume || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        {!stats?.history || stats.history.length === 0 ? <div className="text-xs text-zinc-600 italic bg-[#0a1224] p-3 rounded-xl border border-zinc-800 text-center">No swaps recorded yet.</div> : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
            {stats.history.map((tx:any, i:number) => (
              <div key={i} className="flex justify-between items-center bg-[#0a1224] p-2.5 rounded-xl border border-zinc-800/50 hover:bg-zinc-800 transition-colors">
                <span className="text-xs text-white font-bold">{tx?.amount} {tx?.from_token} ➔ {tx?.to_token}</span>
                <a href={`https://basescan.org/tx/${tx?.tx_hash}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-[#00F0FF] hover:underline">${Number(tx?.usd_value || 0).toFixed(2)}</a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Token Selector Modal */}
      {selectingToken && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <GlassCard className="w-full max-w-sm p-4 bg-[#0a1224] border border-zinc-700 h-[80vh] sm:h-[600px] flex flex-col rounded-b-none sm:rounded-2xl animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">Select Token</h3>
              <button onClick={() => setSelectingToken(null)} className="p-1 bg-zinc-800 rounded-full text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input type="text" placeholder="Search name or paste address" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#050b14] border border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:border-[#00F0FF]/50 outline-none" />
            </div>
            
            <div className="overflow-y-auto space-y-1 flex-1 custom-scrollbar pr-2">
              {filteredTokens.length === 0 ? <div className="text-center text-zinc-500 mt-10 text-sm">No tokens found</div> : 
               filteredTokens.map((token:any) => (
                <button key={token.address + token.chainId} onClick={() => { selectingToken === 'from' ? setFromToken(token) : setToToken(token); setSelectingToken(null); setSearchQuery(''); }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800 text-left group transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={token.logoURI} className="w-9 h-9 rounded-full border border-zinc-700 bg-zinc-900" onError={(e) => { (e.target as any).src = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'; }} />
                    <div>
                      <div className="font-bold text-white group-hover:text-[#00F0FF] transition-colors">{token.symbol}</div>
                      <div className="text-[10px] text-zinc-500">{token.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
