import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Lock, Unlock, History, Activity, Search, X } from 'lucide-react';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Fully populated robust Top 30 Base token list for immediate local loading
const TOP_BASE_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png' },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', decimals: 8, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf.png' },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631.png' },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png' },
  { symbol: 'BRETT', name: 'Brett', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x532f27101965dd16442e59d40670faf5ebb142e4.png' },
  { symbol: 'TOSHI', name: 'Toshi', address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4.png' },
  { symbol: 'VIRTUAL', name: 'Virtual Protocol', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b.png' },
  { symbol: 'HIGHER', name: 'Higher', address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0578d8a44db98b23bf096a382e016e29a5ce0ffe.png' },
  { symbol: 'MFER', name: 'Mfercoin', address: '0xE3086852A4B125803C815a158249ae468A3254Ca', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xe3086852a4b125803c815a158249ae468a3254ca.png' },
  { symbol: 'WELL', name: 'Moonwell', address: '0xA88594D404727625C9ED8514cb831A624E7986c7', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xa88594d404727625c9ed8514cb831a624e7986c7.png' },
  { symbol: 'KEYCAT', name: 'Keyboard Cat', address: '0x7bFBa1b0b5A3445CDE83ba12DB4f9B37E552824D', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x7bfba1b0b5a3445cde83ba12db4f9b37e552824d.png' },
  { symbol: 'NORMIE', name: 'Normie', address: '0x7F12d13B34F5F4f0a9449c16Bcd42f0da47AF200', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x7f12d13b34f5f4f0a9449c16bcd42f0da47af200.png' },
  { symbol: 'ROOST', name: 'Roost', address: '0xe1db4dcac9a7c3cecb3f10134bc26d36e88383e9', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xe1db4dcac9a7c3cecb3f10134bc26d36e88383e9.png' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png' },
  { symbol: 'SNX', name: 'Synthetix', address: '0x22e6966B799c4D5B13Be962E1D117b56327FDa66', decimals: 18, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F/logo.png' },
  { symbol: 'LUNA', name: 'Luna', address: '0x55A51Eabf5eb3CA677F43Eea47bfa7c588EAA833', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x55a51eabf5eb3ca677f43eea47bfa7c588eaa833.png' },
  { symbol: 'AIX', name: 'AIX', address: '0x0d41F61EEf6D17C9dBB4C03B52BA2B702951C8D4', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0d41f61eef6d17c9dbb4c03b52ba2b702951c8d4.png' },
  { symbol: 'ALIEN', name: 'Alien Base', address: '0x1FfFfbA0007A8A3f43ebF468E63920F52a7C8D11', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x1ffffba0007a8a3f43ebf468e63920f52a7c8d11.png' },
  { symbol: 'EZETH', name: 'Renzo ezETH', address: '0x2416092f143378750bb29b79eD961ab195CcEea5', decimals: 18, logoURI: 'https://dd.dexscreener.com/ds-data/tokens/base/0x2416092f143378750bb29b79ed961ab195cceea5.png' }
];

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [tokens, setTokens] = useState<any[]>(TOP_BASE_TOKENS);
  const [fromToken, setFromToken] = useState<any>(TOP_BASE_TOKENS[0]); // ETH
  const [toToken, setToToken] = useState<any>(TOP_BASE_TOKENS[1]); // USDC
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  
  const [isAmountLocked, setIsAmountLocked] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [selectingToken, setSelectingToken] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`swap_stats_${address}`) || '{"totalVolume":0,"history":[]}'); } 
    catch { return { totalVolume: 0, history: [] }; }
  });

  // Background token fetch (adds extra obscure tokens but doesn't block the UI)
  useEffect(() => {
    fetch('https://li.quest/v1/tokens?chains=base')
      .then(res => res.json())
      .then(data => {
        if (data.tokens && data.tokens[8453]) {
          // Merge top tokens with the rest of the API response, removing duplicates
          const apiTokens = data.tokens[8453];
          const uniqueTokens = [...TOP_BASE_TOKENS];
          apiTokens.forEach((t: any) => {
            if (!uniqueTokens.find(ut => ut.address.toLowerCase() === t.address.toLowerCase())) {
              uniqueTokens.push(t);
            }
          });
          setTokens(uniqueTokens);
        }
      }).catch(err => console.error("Could not fetch extended token list", err));
  }, []);

  const { data: fromBalance, refetch: refetchFromBalance } = useBalance({ address, token: fromToken?.address === NATIVE_TOKEN_ADDRESS ? undefined : fromToken?.address as Address });
  const { refetch: refetchToBalance } = useBalance({ address, token: toToken?.address === NATIVE_TOKEN_ADDRESS ? undefined : toToken?.address as Address });

  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address) return setQuote(null);
      setIsFetchingQuote(true);
      try {
        const parsedAmount = parseUnits(amount, fromToken.decimals).toString();
        const response = await fetch(`https://li.quest/v1/quote?fromChain=8453&toChain=8453&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}&slippage=${parseFloat(slippage) / 100}`);
        const data = await response.json();
        setQuote(data.transactionRequest ? data : null);
      } catch { setQuote(null); } finally { setIsFetchingQuote(false); }
    };
    const tId = setTimeout(fetchQuote, 400);
    return () => clearTimeout(tId);
  }, [amount, fromToken, toToken, address, slippage]);

  const handlePercentage = (percent: number) => {
    if (!fromBalance) return;
    const total = Number(fromBalance.formatted);
    const val = (percent === 100 && fromToken.address === NATIVE_TOKEN_ADDRESS) ? Math.max(0, total - 0.001) : total * (percent / 100);
    setAmount(val.toFixed(6).replace(/\.?0+$/, ''));
  };

  const handleSwap = async () => {
    if (!quote || !address || !publicClient) return toast.error('Wait for a valid route');
    setIsSwapping(true);
    const toastId = toast.loading('Initializing swap…');

    try {
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });

      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData = hasBuilderCode(rawData) ? rawData : appendBuilderCode(rawData);

      if (fromToken.address !== NATIVE_TOKEN_ADDRESS) {
        toast.loading('Checking allowance…', { id: toastId });
        const allowance = await publicClient.readContract({ address: fromToken.address as Address, abi: erc20Abi, functionName: 'allowance', args: [address, quote.estimate.approvalAddress as Address] });
        if (allowance < BigInt(quote.estimate.fromAmount)) {
          toast.loading('Approve token…', { id: toastId });
          const tx = await writeContractAsync({ address: fromToken.address as Address, abi: erc20Abi, functionName: 'approve', args: [quote.estimate.approvalAddress as Address, BigInt(quote.estimate.fromAmount)] });
          await publicClient.waitForTransactionReceipt({ hash: tx });
        }
      }

      toast.loading('Confirming swap…', { id: toastId });
      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as Address,
        data: finalData,
        value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
      });

      toast.loading('Processing…', { id: toastId });
      await publicClient.waitForTransactionReceipt({ hash });

      await Promise.all([refetchFromBalance(), refetchToBalance()]);
      
      const usdValue = parseFloat(quote.estimate.fromAmountUSD || '0');
      const newStats = { totalVolume: stats.totalVolume + usdValue, history: [{ hash, from: fromToken.symbol, to: toToken.symbol, amt: amount, usd: usdValue, date: new Date().toISOString() }, ...stats.history].slice(0, 10) };
      setStats(newStats); localStorage.setItem(`swap_stats_${address}`, JSON.stringify(newStats));

      toast.success('Swap completed!', { id: toastId });
      if (!isAmountLocked) setAmount('');
    } catch (error: any) {
      toast.error("Swap failed.", { id: toastId });
    } finally { setIsSwapping(false); }
  };

  const filteredTokens = tokens.filter(t => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.address.toLowerCase() === searchQuery.toLowerCase());

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-black text-white tracking-widest">NEXUS SWAP</h2>
        <button onClick={() => setShowSettings(!showSettings)} className="text-zinc-400 hover:text-[#00F0FF] transition-colors"><Settings className="w-5 h-5" /></button>
      </div>

      {showSettings && (
        <GlassCard className="p-4 border-[#00F0FF]/30 bg-[#050b14]">
          <p className="text-xs font-bold text-zinc-400 mb-2 uppercase">Max Slippage</p>
          <div className="flex gap-2">
            {['0.1', '0.5', '1.0'].map(val => (
              <button key={val} onClick={() => setSlippage(val)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${slippage === val ? 'bg-[#00F0FF] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-700'}`}>{val}%</button>
            ))}
            <input type="number" value={slippage} onChange={(e) => setSlippage(e.target.value)} className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-2 text-xs text-white outline-none focus:border-[#00F0FF]" placeholder="Custom %" />
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-3 border-[#00F0FF]/20 shadow-2xl bg-[#0a1224]">
        <div className="bg-[#050b14] p-4 rounded-2xl border border-zinc-800">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-zinc-400 font-bold uppercase">You Pay</span>
            <span className="text-zinc-500 font-mono">Bal: {fromBalance ? Number(fromBalance.formatted).toFixed(4) : '0.0000'}</span>
          </div>
          <div className="flex gap-4 items-center">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isAmountLocked} placeholder="0.0" className="bg-transparent text-3xl font-black text-white outline-none w-full disabled:opacity-50" />
            <button onClick={() => setSelectingToken('from')} className="flex items-center gap-2 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 px-3 py-2 rounded-xl text-white font-bold border border-[#00F0FF]/30 shrink-0">
              <img src={fromToken.logoURI || fromToken.logo} className="w-6 h-6 rounded-full bg-zinc-900" /> {fromToken.symbol} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="flex gap-1.5">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => handlePercentage(pct)} disabled={isAmountLocked} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-300">{pct === 100 ? 'MAX' : `${pct}%`}</button>
              ))}
            </div>
            <button onClick={() => setIsAmountLocked(!isAmountLocked)} className={`p-1.5 rounded-md transition-colors ${isAmountLocked ? 'bg-[#FF003C]/20 text-[#FF003C]' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {isAmountLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="relative h-2 flex justify-center items-center z-10 my-2">
          <button onClick={() => { setFromToken(toToken); setToToken(fromToken); }} className="bg-[#0a1224] p-2 rounded-xl border border-zinc-700 text-[#00F0FF] hover:rotate-180 transition-transform">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-[#050b14] p-4 rounded-2xl border border-zinc-800">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-zinc-400 font-bold uppercase">You Receive</span>
          </div>
          <div className="flex gap-4 items-center">
            <input type="text" disabled value={quote ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals) : ''} placeholder={isFetchingQuote ? "Routing..." : "0.0"} className="bg-transparent text-3xl font-black text-zinc-500 outline-none w-full" />
            <button onClick={() => setSelectingToken('to')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl text-white font-bold border border-zinc-600 shrink-0">
              <img src={toToken.logoURI || toToken.logo} className="w-6 h-6 rounded-full bg-zinc-900" /> {toToken.symbol} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          {quote && <div className="text-[10px] text-[#00F0FF] mt-2 font-mono">≈ ${Number(quote.estimate.toAmountUSD).toFixed(2)} USD</div>}
        </div>

        <Button onClick={handleSwap} disabled={isSwapping || isFetchingQuote || !amount || !quote} className="w-full mt-4 py-5 text-lg font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-black hover:opacity-90">
          {isSwapping ? 'Executing Route...' : isFetchingQuote ? 'Finding Route...' : !amount ? 'Enter Amount' : 'Swap Now'}
        </Button>
      </GlassCard>

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
                    <img src={token.logoURI || token.logo} className="w-8 h-8 rounded-full border border-zinc-700 bg-black" onError={(e) => { (e.target as any).src = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'; }} />
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
