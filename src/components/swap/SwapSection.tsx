import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract, useSwitchChain } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { GlassCard, Button } from '../ui/GlassUI';
import { Settings, ArrowDown, ChevronDown, Route, Wallet, BarChart3, Search, X, PlusCircle, ArrowRightLeft, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { appendBuilderCode, hasBuilderCode } from '../../lib/wagmi';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

const NETWORKS = [
  { id: 8453, name: 'Base', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' },
  { id: 1, name: 'Ethereum', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  { id: 42161, name: 'Arbitrum', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
  { id: 10, name: 'Optimism', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png' }
];

const DEFAULT_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png', chainId: 8453 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', chainId: 8453 },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', decimals: 8, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf.png', chainId: 8453 },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png', chainId: 8453 },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, logo: 'https://dd.dexscreener.com/ds-data/tokens/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631.png', chainId: 8453 }
];

export function SwapSection() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [mode, setMode] = useState<'swap' | 'bridge'>('swap');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  const [fromChain, setFromChain] = useState(NETWORKS[0]);
  const [toChain, setToChain] = useState(NETWORKS[0]);
  const [fromToken, setFromToken] = useState(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState(DEFAULT_TOKENS[1]);
  
  const [selectingType, setSelectingType] = useState<'fromToken'|'toToken'|'fromChain'|'toChain'|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Balances mapped by token address
  const [balances, setBalances] = useState<Record<string, string>>({});
  
  // Custom CA search
  const [customToken, setCustomToken] = useState<any>(null);

  // Fetch balances for list
  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return;
    const newBalances: Record<string, string> = {};
    
    for (const token of DEFAULT_TOKENS) {
      try {
        if (token.address === NATIVE_TOKEN_ADDRESS) {
          const bal = await publicClient.getBalance({ address });
          newBalances[token.address] = formatUnits(bal, 18);
        } else {
          const bal = await publicClient.readContract({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address]
          });
          newBalances[token.address] = formatUnits(bal as bigint, token.decimals);
        }
      } catch (e) {
        newBalances[token.address] = '0';
      }
    }
    setBalances(newBalances);
  }, [address, publicClient]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  // Handle Quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !address) return setQuote(null);
      setIsFetchingQuote(true);
      try {
        const parsedAmount = parseUnits(amount, fromToken.decimals).toString();
        const res = await fetch(`https://li.quest/v1/quote?fromChain=${fromChain.id}&toChain=${toChain.id}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${parsedAmount}&fromAddress=${address}`);
        const data = await res.json();
        setQuote(data.transactionRequest ? data : null);
      } catch {
        setQuote(null);
      } finally {
        setIsFetchingQuote(false);
      }
    };
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [amount, fromToken, toToken, fromChain, toChain, address]);

  // Contract Search
  useEffect(() => {
    if (searchQuery.startsWith('0x') && searchQuery.length === 42) {
      fetch(`https://li.quest/v1/token?chain=base&token=${searchQuery}`)
        .then(r => r.json())
        .then(d => { if (d.symbol) setCustomToken({...d, logo: d.logoURI || ''}); });
    } else {
      setCustomToken(null);
    }
  }, [searchQuery]);

  const executeTrade = async () => {
    if (!quote || !address || !publicClient) return toast.error('Valid route required');
    setIsSwapping(true);
    const tId = toast.loading('Initiating...');

    try {
      if (chainId !== fromChain.id) {
        toast.loading(`Switching to ${fromChain.name}...`, { id: tId });
        await switchChainAsync({ chainId: fromChain.id });
      }

      const rawData = quote.transactionRequest.data as `0x${string}`;
      const finalData = hasBuilderCode(rawData) ? rawData : appendBuilderCode(rawData);

      if (fromToken.address !== NATIVE_TOKEN_ADDRESS) {
        toast.loading('Checking allowance...', { id: tId });
        const allowance = await publicClient.readContract({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, quote.estimate.approvalAddress]
        });
        if (allowance < BigInt(quote.estimate.fromAmount)) {
          toast.loading('Approve token...', { id: tId });
          const tx = await writeContractAsync({
            address: fromToken.address as Address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [quote.estimate.approvalAddress, BigInt(quote.estimate.fromAmount)]
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
        }
      }

      toast.loading('Confirming transaction...', { id: tId });
      const txValue = quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n;
      
      const hash = await sendTransactionAsync({
        to: quote.transactionRequest.to as `0x${string}`,
        data: finalData,
        value: txValue,
      });

      toast.loading('Broadcasting...', { id: tId });
      await publicClient.waitForTransactionReceipt({ hash });

      fetchBalances();
      toast.success('Transaction Successful!', { id: tId });
      setAmount('');
    } catch (err: any) {
      toast.error(err.message?.includes('funds') ? "Insufficient gas." : "Transaction failed or rejected.", { id: tId });
    } finally {
      setIsSwapping(false);
    }
  };

  const currentFromBalance = balances[fromToken.address] || '0.00';

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Mode Selector */}
      <div className="flex bg-[#0a1224] p-1 rounded-xl border border-[#00F0FF]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
        <button onClick={() => { setMode('swap'); setFromChain(NETWORKS[0]); setToChain(NETWORKS[0]); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'swap' ? 'bg-[#00F0FF]/10 text-[#00F0FF]' : 'text-zinc-500 hover:text-white'}`}>Swap</button>
        <button onClick={() => setMode('bridge')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'bridge' ? 'bg-[#B026FF]/10 text-[#B026FF]' : 'text-zinc-500 hover:text-white'}`}>Bridge</button>
      </div>

      <GlassCard className="p-3 border-[#00F0FF]/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        {/* FROM BLOCK */}
        <div className="bg-[#050b14] p-4 rounded-2xl border border-zinc-800 focus-within:border-[#00F0FF]/50 transition-colors">
          <div className="flex justify-between text-xs mb-3 text-zinc-400">
            <span>You Pay on {fromChain.name}</span>
            <span className="flex items-center gap-1 cursor-pointer hover:text-[#00F0FF]" onClick={() => setAmount(currentFromBalance)}>
              <Wallet className="w-3 h-3" /> {Number(currentFromBalance).toFixed(4)}
            </span>
          </div>
          <div className="flex gap-4 items-center">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" className="bg-transparent text-3xl font-black text-white outline-none w-full" />
            <div className="flex flex-col gap-2">
              {mode === 'bridge' && (
                <button onClick={() => setSelectingType('fromChain')} className="flex items-center justify-between gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg text-xs text-white border border-zinc-700">
                  <img src={fromChain.logo} className="w-4 h-4 rounded-full" /> {fromChain.name} <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>
              )}
              <button onClick={() => setSelectingType('fromToken')} className="flex items-center gap-2 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 px-3 py-2 rounded-xl text-white font-bold border border-[#00F0FF]/30">
                <img src={fromToken.logo} className="w-6 h-6 rounded-full" /> {fromToken.symbol} <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          {quote && <div className="text-[10px] text-zinc-500 mt-2">${Number(quote.estimate.fromAmountUSD).toFixed(2)}</div>}
        </div>

        {/* SWAP ICON */}
        <div className="relative h-2 flex justify-center items-center z-10 my-2">
          <button onClick={() => { setFromToken(toToken); setToToken(fromToken); if(mode==='bridge'){setFromChain(toChain); setToChain(fromChain);} }} className="bg-[#0a1224] p-2 rounded-xl border border-zinc-700 text-[#00F0FF] hover:rotate-180 transition-transform">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* TO BLOCK */}
        <div className="bg-[#050b14] p-4 rounded-2xl border border-zinc-800">
          <div className="flex justify-between text-xs mb-3 text-zinc-400">
            <span>You Receive on {toChain.name}</span>
          </div>
          <div className="flex gap-4 items-center">
            <input type="text" disabled value={quote ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals) : ''} placeholder={isFetchingQuote ? "Routing..." : "0.0"} className="bg-transparent text-3xl font-black text-zinc-500 outline-none w-full" />
            <div className="flex flex-col gap-2">
              {mode === 'bridge' && (
                <button onClick={() => setSelectingType('toChain')} className="flex items-center justify-between gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg text-xs text-white border border-zinc-700">
                  <img src={toChain.logo} className="w-4 h-4 rounded-full" /> {toChain.name} <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>
              )}
              <button onClick={() => setSelectingType('toToken')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl text-white font-bold border border-zinc-600">
                <img src={toToken.logo} className="w-6 h-6 rounded-full" /> {toToken.symbol} <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <Button onClick={executeTrade} disabled={isSwapping || isFetchingQuote || !amount} className="w-full mt-4 py-5 text-lg font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-black hover:opacity-90">
          {isSwapping ? 'Processing...' : isFetchingQuote ? 'Finding Best Route...' : !amount ? 'Enter Amount' : mode === 'bridge' ? 'Review Bridge' : 'Review Swap'}
        </Button>
      </GlassCard>

      {/* Modals */}
      <AnimatePresence>
        {selectingType && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <GlassCard className="w-full max-w-sm p-4 bg-[#0a1224] border border-[#00F0FF]/30 h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-lg">{selectingType.includes('Chain') ? 'Select Network' : 'Select Token'}</h3>
                <button onClick={() => setSelectingType(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {!selectingType.includes('Chain') && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input type="text" placeholder="Search name or 0x..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#050b14] border border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:border-[#00F0FF]/50 outline-none" />
                </div>
              )}

              <div className="overflow-y-auto space-y-1 flex-1 custom-scrollbar pr-2">
                {selectingType.includes('Chain') ? (
                  NETWORKS.map(net => (
                    <button key={net.id} onClick={() => { selectingType === 'fromChain' ? setFromChain(net) : setToChain(net); setSelectingType(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800 text-left">
                      <img src={net.logo} className="w-8 h-8 rounded-full" />
                      <span className="font-bold text-white">{net.name}</span>
                    </button>
                  ))
                ) : (
                  <>
                    {!customToken && DEFAULT_TOKENS.filter(t => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.address.toLowerCase() === searchQuery.toLowerCase()).map(token => (
                      <button key={token.address} onClick={() => { selectingType === 'fromToken' ? setFromToken(token) : setToToken(token); setSelectingType(null); }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800 text-left group">
                        <div className="flex items-center gap-3">
                          <img src={token.logo} className="w-8 h-8 rounded-full border border-zinc-700" />
                          <div>
                            <div className="font-bold text-white group-hover:text-[#00F0FF]">{token.symbol}</div>
                            <div className="text-[10px] text-zinc-500">{token.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white font-mono">{Number(balances[token.address] || 0).toFixed(4)}</div>
                        </div>
                      </button>
                    ))}
                    {customToken && (
                      <button onClick={() => { selectingType === 'fromToken' ? setFromToken(customToken) : setToToken(customToken); setSelectingType(null); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-left mt-2">
                        <img src={customToken.logo} className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="font-bold text-white">{customToken.symbol} <span className="text-[8px] bg-[#B026FF] px-1 rounded ml-1">Import</span></div>
                          <div className="text-[10px] text-zinc-400 truncate w-32">{customToken.address}</div>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
