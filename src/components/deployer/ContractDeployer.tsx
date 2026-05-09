import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Code2, Rocket, Loader2, CheckCircle, Copy, ExternalLink, History } from 'lucide-react';
import { usePublicClient, useAccount, useSendTransaction } from 'wagmi';
import { parseEther, encodeDeployData } from 'viem';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { ERC20_ABI, ERC721_ABI, ERC20_BYTECODE, ERC721_BYTECODE } from '../../lib/contracts';
import { appendBuilderCode } from '../../lib/wagmi';
import { cn } from '@/src/lib/utils';
import { motion } from 'framer-motion';

// The global Smart Wallet EntryPoint address on Base
const ENTRYPOINT_ADDRESS = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'.toLowerCase();

interface DeployedContract {
  address: string;
  name: string;
  symbol: string;
  type: 'ERC20' | 'ERC721';
  timestamp: number;
}

export function ContractDeployer() {
  const { address: userAddress } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();

  const [contractType, setContractType] = useState<'ERC20' | 'ERC721'>('ERC20');
  const [formData, setFormData] = useState({ name: '', symbol: '', supply: '1000000' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<string>('');
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [history, setHistory] = useState<DeployedContract[]>([]);

  useEffect(() => {
    if (userAddress) {
      const saved = localStorage.getItem(`deploy_history_${userAddress}`);
      if (saved) setHistory(JSON.parse(saved));
    }
  }, [userAddress]);

  const saveToHistory = (contract: DeployedContract) => {
    if (!userAddress) return;
    const newHistory = [contract, ...history].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem(`deploy_history_${userAddress}`, JSON.stringify(newHistory));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.symbol.trim()) newErrors.symbol = 'Symbol is required';
    if (contractType === 'ERC20' && (!formData.supply || Number(formData.supply) <= 0)) newErrors.supply = 'Supply must be > 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeploy = async () => {
    if (!validate() || !userAddress || !publicClient) return;
    
    setIsDeploying(true);
    setDeployStep('Preparing deployment...');
    const toastId = toast.loading('Initializing deployment...');

    try {
      const isERC20 = contractType === 'ERC20';
      const abi = isERC20 ? ERC20_ABI : ERC721_ABI;
      const args = isERC20 ? [formData.name, formData.symbol, 18, parseEther(formData.supply)] : [formData.name, formData.symbol];
      const rawBytecode = isERC20 ? ERC20_BYTECODE : ERC721_BYTECODE;
      
      const formattedBytecode = (rawBytecode.startsWith('0x') ? rawBytecode : `0x${rawBytecode}`) as `0x${string}`;
      
      // 1. Encode cleanly without builder code so EVM accepts the deployment payload
      const deployData = encodeDeployData({ abi, bytecode: formattedBytecode, args });

      // 2. Safely inject Builder Code AFTER constructor args are encoded
      const finalDeployData = appendBuilderCode(deployData);

      setDeployStep('Confirm in wallet...');
      toast.loading("Awaiting wallet signature...", { id: toastId });

      // 3. Execute swap-style deployment
      const hash = await sendTransactionAsync({
        data: finalDeployData,
        value: 0n,
      });

      setDeployStep('Waiting for Base network...');
      toast.loading("Broadcasting to network...", { id: toastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
      if (receipt.status === 'reverted') throw new Error("Contract deployment reverted onchain");

      // 4. Smart Wallets: Extract contract address from logs (Skip EntryPoint & User Wallet)
      let finalAddress = receipt.contractAddress;
      if (!finalAddress && receipt.logs && receipt.logs.length > 0) {
        const senderLower = userAddress.toLowerCase();
        const tokenLog = receipt.logs.find(log => {
          const logAddr = log.address.toLowerCase();
          return logAddr !== ENTRYPOINT_ADDRESS && logAddr !== senderLower;
        });
        if (tokenLog) {
          finalAddress = tokenLog.address;
        }
      }

      if (!finalAddress) throw new Error("Could not retrieve the newly deployed contract address from logs.");

      setDeployedAddress(finalAddress);
      
      // 5. Auto-Add Token to Wallet (MetaMask / Coinbase)
      if (window.ethereum && isERC20) {
        try {
          await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC20',
              options: { address: finalAddress, symbol: formData.symbol, decimals: 18 }
            }
          });
        } catch (e) {
          console.log("User rejected watchAsset or not supported");
        }
      }
      
      try {
        await supabase.from('deployments').insert([{
          user_address: userAddress,
          contract_address: finalAddress,
          contract_type: contractType,
          tx_hash: hash
        }]);
      } catch (err) {}

      toast.success(`${contractType} Deployed Successfully!`, { id: toastId });

      saveToHistory({
        address: finalAddress,
        name: formData.name,
        symbol: formData.symbol,
        type: contractType,
        timestamp: Date.now()
      });

      setFormData({ name: '', symbol: '', supply: '1000000' });

    } catch (error: any) {
      console.error('Deployment Error:', error);
      let msg = error.shortMessage || error.message || "Failed to deploy contract.";
      if (msg.toLowerCase().includes('insufficient funds')) msg = "Insufficient Base ETH for deployment gas fees.";
      else if (msg.includes('User rejected')) msg = "Transaction cancelled in wallet.";
      toast.error("Deployment Failed", { id: toastId, description: msg });
    } finally {
      setIsDeploying(false);
      setDeployStep('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <GlassCard className="p-8 border-[#00F0FF]/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[#050b14]">
        <div className="flex items-center gap-3 mb-8">
          <Code2 className="w-8 h-8 text-[#00F0FF]" />
          <h2 className="text-3xl font-black text-white">Forge Contract</h2>
        </div>

        {deployedAddress ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-8 text-center bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-3xl">
            <CheckCircle className="w-20 h-20 text-[#00F0FF] mx-auto mb-6" />
            <h3 className="text-3xl font-black text-white mb-2">{contractType} Deployed!</h3>
            <p className="text-white/60 mb-6">Your contract is now permanently live on Base Mainnet.</p>
            
            <div className="bg-[#0a1224] rounded-2xl p-6 my-6 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider font-bold">Contract Address</p>
              <div className="flex items-center gap-3 justify-center">
                <code className="text-sm font-mono text-[#00F0FF] break-all flex-1">{deployedAddress}</code>
                <button onClick={() => { navigator.clipboard.writeText(deployedAddress); toast.success("Copied!"); }} className="text-zinc-500 hover:text-white shrink-0 transition-colors">
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={() => setDeployedAddress(null)} className="px-8 py-3 text-black bg-[#00F0FF] hover:bg-white">Deploy Another</Button>
              <Button variant="outline" onClick={() => window.open(`https://basescan.org/address/${deployedAddress}`, '_blank')} className="px-8 py-3 flex items-center gap-2 border-[#00F0FF]/50 text-[#00F0FF] hover:bg-[#00F0FF]/10">
                <ExternalLink className="w-4 h-4" /> View on BaseScan
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-zinc-400 block mb-3">Choose Contract Type</label>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setContractType('ERC20'); setFormData({ name: '', symbol: '', supply: '1000000' }); }} className={cn("p-6 rounded-2xl border-2 transition-all text-center", contractType === 'ERC20' ? "border-[#00F0FF] bg-[#00F0FF]/10" : "border-zinc-800 bg-[#0a1224] hover:border-zinc-600")}>
                  <div className="text-2xl mb-2">💰</div>
                  <div className="font-bold text-white">ERC-20 Token</div>
                  <div className="text-xs text-zinc-500 mt-1">Fungible Token</div>
                </button>
                <button onClick={() => { setContractType('ERC721'); setFormData({ name: '', symbol: '', supply: '1000000' }); }} className={cn("p-6 rounded-2xl border-2 transition-all text-center", contractType === 'ERC721' ? "border-[#B026FF] bg-[#B026FF]/10" : "border-zinc-800 bg-[#0a1224] hover:border-zinc-600")}>
                  <div className="text-2xl mb-2">🎨</div>
                  <div className="font-bold text-white">ERC-721 NFT</div>
                  <div className="text-xs text-zinc-500 mt-1">Non-Fungible Token</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400 font-bold">Name</label>
                <input placeholder={contractType === 'ERC20' ? "e.g. Base Nexus" : "e.g. Base Pass NFT"} className={cn("w-full bg-[#0a1224] border rounded-xl px-4 py-3 text-white outline-none transition-all", errors.name ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#00F0FF]/50")} value={formData.name} onChange={(e) => { setFormData({...formData, name: e.target.value}); if (errors.name) setErrors({...errors, name: ''}); }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400 font-bold">Symbol</label>
                <input placeholder={contractType === 'ERC20' ? "e.g. NEXUS" : "e.g. BNP"} className={cn("w-full bg-[#0a1224] border rounded-xl px-4 py-3 text-white outline-none transition-all", errors.symbol ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#00F0FF]/50")} value={formData.symbol} onChange={(e) => { setFormData({...formData, symbol: e.target.value}); if (errors.symbol) setErrors({...errors, symbol: ''}); }} />
              </div>
            </div>

            {contractType === 'ERC20' && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-400 font-bold">Initial Supply</label>
                <input type="number" placeholder="1,000,000" className={cn("w-full bg-[#0a1224] border rounded-xl px-4 py-3 text-white outline-none transition-all", errors.supply ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#00F0FF]/50")} value={formData.supply} onChange={(e) => { setFormData({...formData, supply: e.target.value}); if (errors.supply) setErrors({...errors, supply: ''}); }} />
              </div>
            )}

            <Button className="w-full py-6 text-lg font-black bg-gradient-to-r from-[#00F0FF] to-[#B026FF] text-black hover:opacity-90 transition-opacity" onClick={handleDeploy} disabled={isDeploying || !userAddress}>
              {isDeploying ? <><Loader2 className="w-5 h-5 animate-spin mr-2 inline" /> Deploying...</> : <><Rocket className="w-5 h-5 mr-2 inline" /> Deploy to Base Mainnet</>}
            </Button>
          </div>
        )}
      </GlassCard>

      <div className="space-y-6">
        <GlassCard className="p-6 bg-[#0a1224] border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-[#00F0FF]" /> History</h3>
            {history.length > 0 && <button onClick={() => { setHistory([]); localStorage.removeItem(`deploy_history_${userAddress}`); }} className="text-[10px] text-zinc-600 hover:text-red-400 font-bold uppercase">Clear</button>}
          </div>
          {history.length === 0 ? <p className="text-xs text-zinc-600 italic text-center py-8">No deployments yet</p> : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {history.map((item, idx) => (
                <div key={idx} className="p-3 bg-[#050b14] rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <div className="text-[10px] text-zinc-500">{item.symbol} • {item.type}</div>
                    </div>
                    <span className="text-[9px] text-zinc-600">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-[#00F0FF]/60 font-mono truncate max-w-[180px]">{item.address}</span>
                    <button onClick={() => { navigator.clipboard.writeText(item.address); toast.success("Copied!"); }} className="text-zinc-600 hover:text-white transition-colors ml-auto">
                      <Copy className="w-3 h-3" />
                    </button>
                    <a href={`https://basescan.org/address/${item.address}`} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-white transition-colors">
                      <ExternalLink className="w-3 h-3" />
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
