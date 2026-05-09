import { useState, useEffect, useRef } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract, useSwitchChain, useBalance } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Route, BarChart3, Search, X, PlusCircle, Lock, Unlock, History, Zap, Clock, Fuel, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';
import { supabase } from '@/src/supabase';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEFAULT_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png', chainId: 8453 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png', chainId: 8453 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', chainId: 8453 },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', decimals: 8, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf.png', chainId: 8453 },
  { symbol: 'USDbC', name: 'Bridged USDC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', chainId: 8453 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png', chainId: 8453 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png', chainId: 8453 },
  { symbol: 'EURC', name: 'EURC', address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', decimals: 6, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42.png', chainId: 8453 },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png', chainId: 8453 },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631.png', chainId: 8453 },
  { symbol: 'BRETT', name: 'Brett', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x532f27101965dd16442e59d40670faf5ebb142e4.png', chainId: 8453 },
  { symbol: 'TOSHI', name: 'Toshi', address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4.png', chainId: 8453 },
  { symbol: 'VIRTUAL', name: 'Virtual Protocol', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b.png', chainId: 8453 },
  { symbol: 'HIGHER', name: 'Higher', address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0578d8a44db98b23bf096a382e016e29a5ce0ffe.png', chainId: 8453 },
  { symbol: 'MFER', name: 'Mfercoin', address: '0xE3086852A4B125803C815a158249ae468A3254Ca', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xe3086852a4b125803c815a158249ae468a3254ca.png', chainId: 8453 },
  { symbol: 'WELL', name: 'Moonwell', address: '0xA88594D404727625C9ED8514cb831A624E7986c7', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xa88594d404727625c9ed8514cb831a624e7986c7.png', chainId: 8453 },
  { symbol: 'KEYCAT', name: 'Keyboard Cat', address: '0x7bFBa1b0b5A3445CDE83ba12DB4f9B37E552824D', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x7bfba1b0b5a3445cde83ba12db4f9b37e552824d.png', chainId: 8453 },
  { symbol: 'ROOST', name: 'Roost', address: '0xe1db4dcac9a7c3cecb3f10134bc26d36e88383e9', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xe1db4dcac9a7c3cecb3f10134bc26d36e88383e9.png', chainId: 8453 },
  { symbol: 'ALIEN', name: 'Alien Base', address: '0x1FfFfbA0007A8A3f43ebF468E63920F52a7C8D11', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x1ffffba0007a8a3f43ebf468e63920f52a7c8d11.png', chainId: 8453 },
  { symbol: 'EZETH', name: 'Renzo ezETH', address: '0x2416092f143378750bb29b79eD961ab195CcEea5', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x2416092f143378750bb29b79ed961ab195cceea5.png', chainId: 8453 },
  { symbol: 'TYBG', name: 'Base God', address: '0x0d97F261b1e88845184f678e2d1e7a98D9FD38dE', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0d97f261b1e88845184f678e2d1e7a98d9fd38de.png', chainId: 8453 },
  { symbol: 'MIGGLES', name: 'Mister Miggles', address: '0xB1a03EdA10342529bBF8EB700a06C60441fEf25d', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xb1a03eda10342529bbf8eb700a06c60441fef25d.png', chainId: 8453 },
  { symbol: 'BENJI', name: 'Basenji', address: '0xBC45647eA894030a4E9801Ec03479739FA2485F0', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xbc45647ea894030a4e9801ec03479739fa2485f0.png', chainId: 8453 },
  { symbol: 'NORMIE', name: 'Normie', address: '0x7F12d13B34F5F4f0a9449c16Bcd42f0da47AF200', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x7f12d13b34f5f4f0a9449c16bcd42f0da47af200.png', chainId: 8453 }
];

// ─── FIX 1: Safe localStorage helper — guards against SSR crash on Vercel ───
function safeGetLocalStorage(key: string, fallback: any) {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function safeSetLocalStorage(key: string, value: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or private browsing — fail silently
  }
}

// ─── FIX 2: Safe BigInt parser — handles floats, hex, null/undefined ────────
function safeBigInt(value: any, fallback: bigint = 0n): bigint {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    // Handle hex strings (0x...) from LI.FI
    if (typeof value === 'string' && value.startsWith('0x')) {
      return BigInt(value);
    }
    // Handle floats by flooring them — BigInt('123.45') throws
    const str = String(value);
    const floored = str.includes('.') ? str.split('.')[0] : str;
    return BigInt(floored);
  } catch {
    return fallback;
  }
}

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);

  // FIX 1 applied: no longer crashes during SSR
  const [savedTokens, setSavedTokens] = useState<any[]>(() => safeGetLocalStorage('custom_tokens', []));

  const [fromToken, setFromToken] = useState<any>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<any>(DEFAULT_TOKENS[1]);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);

  const [selectingToken, setSelectingToken] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingContract, setIsSearchingContract] = useState(false);
  const [customTokenResult, setCustomTokenResult] = useState<any>(null);

  const [slippage, setSlippage] = useState('0.5');
  const [isAmountLocked, setIsAmountLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [dbStats, setDbStats] = useState({ totalVolume: 0, history: [] as any[] });

  // FIX 3: AbortController ref to cancel stale quote fetches
  const quoteAbortRef = useRef<AbortController | null>(null);

  const fetchAccurateHistory = async () => {
    if (!address) return;
    try {
      const { data, error } = await supabase
        .from('user_swaps')
        .select('*')
        .eq('user_address', address)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const total = data.reduce((sum, tx) => sum + Number(tx.usd_value || 0), 0);
        setDbStats({ totalVolume: total, history: data });
      }
    } catch (err) {
      console.error('Database sync failed', err);
    }
  };

  useEffect(() => { fetchAccurateHistory(); }, [address]);

  const { data: fromBalance, refetch: refetchFromBalance } = useBalance({
    address,
    token: fromToken.address === NATIVE_TOKEN_ADDRESS ? undefined : fromToken.address as Address,
  });

  // FIX 4: Destructure `data` so we can actually display the toToken balance
  const { data: toBalance, refetch: refetchToBalance } = useBalance({
    address,
    token: toToken.address === NATIVE_TOKEN_ADDRESS ? undefined : toToken.address as Address,
  });

  // Quote fetching with abort controller to prevent race conditions
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address) {
        setQuote(null);
        return;
      }

      // Cancel any in-flight request
      if (quoteAbortRef.current) quoteAbortRef.current.abort();
      const controller = new AbortController();
      quoteAbortRef.current = controller;

      setIsFetchingQuote(true);
      try {
        const parsedAmount = parseUnits(amount, fromToken.decimals).toString();
        const response = await fetch(
          `https://li.quest/v1/quote?fromChain=${fromToken.chainId}&toChain=${toToken.chainId}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}&slippage=${parseFloat(slippage) / 100}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!controller.signal.aborted) {
          if (data?.transactionRequest) setQuote(data);
          else setQuote(null);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Quote fetch failed:', error);
          setQuote(null);
        }
      } finally {
        if (!controller.signal.aborted) setIsFetchingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => {
      clearTimeout(timeoutId);
      if (quoteAbortRef.current) quoteAbortRef.current.abort();
    };
  }, [amount, fromToken, toToken, address, slippage]);

  useEffect(() => {
    const searchCustomToken = async () => {
      if (searchQuery.startsWith('0x') && searchQuery.length === 42) {
        setIsSearchingContract(true);
        try {
          const res = await fetch(`https://li.quest/v1/token?chain=base&token=${searchQuery}`);
          const data = await res.json();
          if (data?.symbol) {
            setCustomTokenResult({
              symbol: data.symbol,
              name: data.name,
              address: data.address,
              decimals: data.decimals,
              logo: data.logoURI || 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
              chainId: 8453
            });
          } else {
            setCustomTokenResult(null);
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

  const handlePercentage = (percent: number) => {
    if (!fromBalance?.formatted) return;
    const total = Number(fromBalance.formatted);
    if (isNaN(total)) return;
    const val = (percent === 100 && fromToken.address === NATIVE_TOKEN_ADDRESS)
      ? Math.max(0, total - 0.0015)
      : total * (percent / 100);
    setAmount(val.toFixed(6).replace(/\.?0+$/, ''));
  };

  const handleSwap = async () => {
    if (!quote || !address || !publicClient) return toast.error('Wait for a valid route');
    if (!quote.transactionRequest?.to || !quote.transactionRequest?.data) {
      return toast.error('Invalid route — please refresh the quote');
    }

    setIsSwapping(true);
    const toastId = toast.loading('Initializing swap…');

    try {
      if (chainId !== fromToken.chainId) {
        toast.loading('Switching to Base…', { id: toastId });
        await switchChainAsync({ chainId: fromToken.chainId });
      }

      const rawData = (quote.transactionRequest.data as `0x${string}`) || '0x';
      const finalData = hasBuilderCode(rawData) ? rawData : appendBuilderCode(rawData);

      const isNative = fromToken.address === NATIVE_TOKEN_ADDRESS;
      if (!isNative) {
        toast.loading('Checking allowance…', { id: toastId });
        const spender = quote.estimate?.approvalAddress as Address;
        if (!spender) throw new Error('No approval address in quote');

        const allowance = await publicClient.readContract({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, spender],
        });

        // FIX 2 applied: safe BigInt parse for fromAmount
        const requiredAmount = safeBigInt(quote.estimate?.fromAmount);
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

      // FIX 2 applied: safe BigInt parse for value — handles null, hex, float
      const txValue = safeBigInt(quote.transactionRequest.value, 0n);
      // FIX 2 applied: safe BigInt parse for gasLimit
      const gasLimit = safeBigInt(quote.transactionRequest.gasLimit || quote.transactionRequest.gas, 600000n);

      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: txValue,
        gas: gasLimit,
      });

      toast.loading('Broadcasting to network…', { id: toastId });
      await publicClient.waitForTransactionReceipt({ hash });

      await Promise.all([refetchFromBalance(), refetchToBalance()]);

      try {
        const usdValue = parseFloat(quote.estimate?.toAmountUSD || '0');
        await supabase.from('user_swaps').insert({
          user_address: address,
          tx_hash: hash,
          from_token: fromToken.symbol,
          to_token: toToken.symbol,
          amount: amount,
          usd_value: usdValue
        });
        await fetchAccurateHistory();
      } catch (e) {
        console.error('Failed to log to Supabase', e);
      }

      toast.success('Swap completed successfully!', { id: toastId });
      if (!isAmountLocked) setAmount('');
    } catch (error: any) {
      let msg = 'Swap failed. Please try again.';
      const errMsg = error?.message?.toLowerCase() || '';
      if (errMsg.includes('user rejected') || errMsg.includes('user denied')) msg = 'Cancelled in wallet.';
      else if (errMsg.includes('insufficient funds')) msg = 'Insufficient Base ETH for gas fees.';
      else if (errMsg.includes('no approval address')) msg = 'Invalid quote — please wait for a fresh route.';
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

  // FIX 5 applied: safe toAmount parsing for display
  const toAmountFormatted = (() => {
    if (!quote?.estimate?.toAmount) return '';
    try {
      return formatUnits(safeBigInt(quote.estimate.toAmount), toToken.decimals);
    } catch {
      return '';
    }
  })();

  const priceImpact =
    quote?.estimate?.fromAmountUSD && quote?.estimate?.toAmountUSD
      ? ((parseFloat(quote.estimate.fromAmountUSD) - parseFloat(quote.estimate.toAmountUSD)) / parseFloat(quote.estimate.fromAmountUSD)) * 100
      : 0;
  const gasCostUsd = parseFloat(quote?.estimate?.gasCosts?.[0]?.amountUSD || '0');

  return (
    <div className="w-full max-w-[480px] mx-auto space-y-4">

      <GlassCard className="p-4 flex justify-between items-center bg-[#0a1224] border-white/5 shadow-lg rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00F0FF]/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#00F0FF]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Your Volume</p>
            <p className="text-sm font-black text-white">
              ${dbStats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Swaps</p>
          <p className="text-sm font-black text-white">{dbStats.history.length}</p>
        </div>
      </GlassCard>

      <GlassCard className="p-2 overflow-hidden border-[#00F0FF]/20 shadow-2xl rounded-3xl bg-[#0a1224]">
        <div className="flex justify-between items-center px-4 pt-3 pb-2">
          <h2 className="text-lg font-black text-white tracking-widest flex items-center gap-2">
            <Route className="w-5 h-5 text-[#B026FF]" /> EXCHANGE
          </h2>
          <button onClick={() => setShowSettings(!showSettings)} className="text-zinc-400 hover:text-[#00F0FF] transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-2">
              <div className="flex gap-2">
                {['0.1', '0.5', '1.0'].map(val => (
                  <button
                    key={val}
                    onClick={() => setSlippage(val)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${slippage === val ? 'bg-[#00F0FF] text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-700'}`}
                  >
                    {val}%
                  </button>
                ))}
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2 text-xs text-white outline-none"
                  placeholder="Custom"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FROM token */}
        <div className="bg-[#050b14] p-4 rounded-[22px] m-1 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-zinc-500 font-bold uppercase">You Pay</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <input
              type="number"
              placeholder="0.0"
              disabled={isAmountLocked}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-4xl font-black text-white outline-none w-full disabled:opacity-50"
            />
            <button
              onClick={() => setSelectingToken('from')}
              className="flex items-center gap-2 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 px-3 py-2 rounded-2xl transition-all shrink-0 shadow-sm border border-[#00F0FF]/20"
            >
              <img src={fromToken.logo} alt={fromToken.symbol} className="w-6 h-6 rounded-full bg-zinc-900" />
              <span className="font-bold text-white text-lg">{fromToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-[#00F0FF]" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-1.5">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => handlePercentage(pct)}
                  disabled={isAmountLocked}
                  className="px-2.5 py-1 bg-zinc-800/50 hover:bg-zinc-700 rounded-md text-[10px] font-bold text-zinc-400"
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-mono">
                Bal: {fromBalance ? Number(fromBalance.formatted).toFixed(4) : '0.0000'}
              </span>
              <button
                onClick={() => setIsAmountLocked(!isAmountLocked)}
                className={`p-1.5 rounded-md transition-colors ${isAmountLocked ? 'bg-[#FF003C]/20 text-[#FF003C]' : 'text-zinc-500 hover:text-white'}`}
              >
                {isAmountLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Swap direction button */}
        <div className="relative h-1 flex justify-center items-center z-10 my-1">
          <button
            onClick={() => { setFromToken(toToken); setToToken(fromToken); setQuote(null); setAmount(''); }}
            className="bg-[#0a1224] p-2.5 rounded-xl border-4 border-[#0a1224] text-[#00F0FF] bg-zinc-800 hover:text-white hover:rotate-180 transition-all duration-300"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* TO token */}
        <div className="bg-[#050b14] p-4 rounded-[22px] m-1 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-zinc-500 font-bold uppercase">You Receive</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <input
              type="text"
              disabled
              // FIX 5 applied: safe formatted output — no more BigInt crash
              value={toAmountFormatted}
              placeholder={isFetchingQuote ? 'Routing...' : '0.0'}
              className="bg-transparent text-4xl font-black text-white/50 outline-none w-full"
            />
            <button
              onClick={() => setSelectingToken('to')}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-2xl transition-all shrink-0 shadow-sm border border-zinc-700"
            >
              <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6 rounded-full bg-zinc-900" />
              <span className="font-bold text-white text-lg">{toToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/60" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-4">
            {/* FIX 4 applied: shows actual toToken balance instead of always "Syncing..." */}
            <span className="text-xs text-zinc-500 font-mono">
              Bal: {toBalance ? Number(toBalance.formatted).toFixed(4) : '0.0000'}
            </span>
            {quote?.estimate?.toAmountUSD && (
              <div className="text-sm font-bold text-zinc-400">
                ≈ ${parseFloat(quote.estimate.toAmountUSD).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Quote details */}
        <AnimatePresence>
          {quote && !isFetchingQuote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 mx-1 p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-sm"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" /> Best Route
                </span>
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
                  <span className="font-bold text-zinc-300">~{Math.ceil((quote.estimate?.executionDuration || 30) / 60)} min</span>
                </div>
                <div className="flex flex-col items-center bg-zinc-900 p-2 rounded-xl border border-zinc-800/50">
                  <ShieldAlert className={`w-4 h-4 mb-1 ${priceImpact > 5 ? 'text-[#FF003C]' : priceImpact > 1 ? 'text-yellow-400' : 'text-[#00FF00]'}`} />
                  <span className={`font-bold ${priceImpact > 5 ? 'text-[#FF003C]' : 'text-zinc-300'}`}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-1 mt-2">
          <Button
            onClick={handleSwap}
            disabled={isSwapping || isFetchingQuote || !amount || !quote}
            className="w-full py-5 text-lg font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-white shadow-lg hover:opacity-90 rounded-2xl tracking-widest"
          >
            {isSwapping ? 'Swapping...' : isFetchingQuote ? 'Fetching Route...' : !amount ? 'Enter Amount' : !quote ? 'No Route Found' : 'Review Swap'}
          </Button>
        </div>
      </GlassCard>

      {/* Recent activity */}
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 text-zinc-500 mb-3">
          <History className="w-4 h-4 text-[#00F0FF]" />
          <span className="text-xs font-bold uppercase tracking-wider">Recent Activity</span>
        </div>
        {dbStats.history.length === 0 ? (
          <p className="text-xs text-zinc-600 italic text-center p-4 border border-zinc-800 rounded-xl bg-[#050b14]">
            No swaps recorded yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {dbStats.history.map((tx: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-[#0a1224] p-3 rounded-xl border border-zinc-800/50 hover:bg-zinc-800 transition-colors">
                <span className="text-xs text-white font-bold">{tx?.amount} {tx?.from_token} ➔ {tx?.to_token}</span>
                <a
                  href={`https://basescan.org/tx/${tx?.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[#00F0FF] hover:underline font-mono"
                >
                  ${Number(tx?.usd_value || 0).toFixed(2)}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Token selector modal */}
      <AnimatePresence>
        {selectingToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <GlassCard className="w-full max-w-sm p-4 flex flex-col h-[600px] max-h-[80vh] bg-[#0a1224] border-[#00F0FF]/20 shadow-2xl rounded-3xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white tracking-widest uppercase">Select Token</h3>
                <button
                  onClick={() => { setSelectingToken(null); setSearchQuery(''); setCustomTokenResult(null); }}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search name or paste 0x address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#050b14] border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:border-[#00F0FF]/50"
                />
              </div>

              <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                {!isSearchingContract && !customTokenResult && filteredTokens.map(token => (
                  <button
                    key={token.address}
                    onClick={() => {
                      if (selectingToken === 'from') setFromToken(token);
                      else setToToken(token);
                      setSelectingToken(null);
                      setSearchQuery('');
                      setQuote(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img src={token.logo} className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900" />
                      <div>
                        <div className="font-bold text-white text-sm group-hover:text-[#00F0FF] transition-colors">{token.symbol}</div>
                        <div className="text-[10px] text-zinc-500">{token.name}</div>
                      </div>
                    </div>
                  </button>
                ))}

                {isSearchingContract && (
                  <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-sm gap-2">
                    <div className="w-5 h-5 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
                    Searching Base network...
                  </div>
                )}

                {customTokenResult && !isSearchingContract && (
                  <button
                    onClick={() => {
                      const newTokens = [...savedTokens, customTokenResult];
                      setSavedTokens(newTokens);
                      // FIX 1 applied: safe localStorage write
                      safeSetLocalStorage('custom_tokens', newTokens);
                      if (selectingToken === 'from') setFromToken(customTokenResult);
                      else setToToken(customTokenResult);
                      setSelectingToken(null);
                      setSearchQuery('');
                      setCustomTokenResult(null);
                      setQuote(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all text-left group mt-2"
                  >
                    <div className="flex items-center gap-3">
                      <img src={customTokenResult.logo} className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {customTokenResult.symbol}
                          <span className="text-[9px] bg-[#00F0FF]/20 text-[#00F0FF] px-1.5 py-0.5 rounded">New</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate w-32">{customTokenResult.address}</div>
                      </div>
                    </div>
                    <PlusCircle className="w-5 h-5 text-[#00F0FF]" />
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
