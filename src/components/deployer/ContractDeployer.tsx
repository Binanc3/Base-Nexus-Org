import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Code2, Rocket, Loader2, CheckCircle, Copy, ExternalLink, Zap, Info, History } from 'lucide-react';
import { usePublicClient, useAccount, useSendTransaction } from 'wagmi';
import { parseEther, encodeDeployData } from 'viem';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { ERC20_ABI, ERC721_ABI, ERC20_BYTECODE, ERC721_BYTECODE } from '../../lib/contracts';
import { cn } from '@/src/lib/utils';
import { motion } from 'framer-motion';

interface DeployedContract {
  address: string;
  name: string;
  symbol: string;
  type: 'ERC20' | 'ERC721';
  timestamp: number;
}

export function ContractDeployer() {
  const { address: userAddress } = useAccount();
  const { sendTransactionAsync } = useSendTransaction(); // Swap-style execution engine
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
    if (contractType === 'ERC20') {
      if (!formData.supply || Number(formData.supply) <= 0) newErrors.supply = 'Supply must be > 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeploy = async () => {
    if (!validate() || !userAddress || !publicClient) return;
    
    setIsDeploying(true);
    setDeployStep('Preparing deployment...');
    const toastId = toast.loading('Initializing deployment...');

    try {
      let abi: any[];
      let args: any[];
      let rawBytecode: string;

      if (contractType === 'ERC20') {
        abi = ERC20_ABI;
        args = [formData.name, formData.symbol, 18, parseEther(formData.supply)];
        rawBytecode = ERC20_BYTECODE;
      } else {
        abi = ERC721_ABI;
        args = [formData.name, formData.symbol];
        rawBytecode = ERC721_BYTECODE;
      }
      
      const formattedBytecode = (rawBytecode.startsWith('0x') ? rawBytecode : `0x${rawBytecode}`) as `0x${string}`;

      // Encode the deployment properly (NO BUILDER HEX ATTACHED to prevent EVM corruption)
      const deployData = encodeDeployData({
        abi,
        bytecode: formattedBytecode,
        args,
      });

      setDeployStep('Confirm in wallet...');
      toast.loading("Awaiting wallet signature...", { id: toastId });

      // OMITTING 'to:' TELLS THE BLOCKCHAIN TO CREATE A NEW CONTRACT
      const hash = await sendTransactionAsync({
        data: deployData,
        value: 0n,
      });

      setDeployStep('Waiting for Base network...');
      toast.loading("Broadcasting to network...", { id: toastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
      
      if (receipt.status === 'reverted') {
        throw new Error("Contract deployment reverted onchain");
      }

      const address = receipt.contractAddress;
      if (!address) throw new Error("No contract address returned");

      setDeployedAddress(address);
      
      try {
        await supabase.from('deployments').insert([{
          user_address: userAddress,
          contract_address: address,
          contract_type: contractType,
          tx_hash: hash
        }]);
      } catch (err) {
        console.error("Supabase Error:", err);
      }

      toast.success(`${contractType} Deployed Successfully!`, { 
        id: toastId,
        description: `View it live on BaseScan.`
      });

      saveToHistory({
        address,
        name: formData.name,
        symbol: formData.symbol,
        type: contractType,
        timestamp: Date.now()
      });

      setFormData({ name: '', symbol: '', supply: '1000000' });

    } catch (error: any) {
      console.error('Deployment Error:', error);
      let msg = error.shortMessage || error.message || "Failed to deploy contract.";
      if (msg.toLowerCase().includes('insufficient funds')) {
         msg = "Insufficient Base ETH for deployment gas fees.";
      } else if (msg.includes('User rejected')) {
         msg = "Transaction cancelled in wallet.";
      }
      toast.error("Deployment Failed", { id: toastId, description: msg });
    } finally {
      setIsDeploying(false);
      setDeployStep('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      <GlassCard className="lg:col-span-2 p-8">
        <div className="flex items-center gap-3 mb-8">
          <Code2 className="w-8 h-8 text-blue-400" />
          <h2 className="text-3xl font-bold text-white">One-Click Deploy</h2>
        </div>

        {deployedAddress ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-8 text-center bg-green-500/10 border border-green-500/20 rounded-3xl">
            <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-6" />
            <h3 className="text-3xl font-bold text-white mb-2">{contractType} Deployed!</h3>
            <p className="text-white/60 mb-6">Your contract is now permanently live on Base Mainnet.</p>
            
            <div className="bg-black/40 rounded-2xl p-6 mb-6 border border-white/10">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider font-bold">Contract Address</p>
              <div className="flex items-center gap-3 justify-center">
                <code className="text-sm font-mono text-blue-400 break-all flex-1">{deployedAddress}</code>
                <button onClick={() => { navigator.clipboard.writeText(deployedAddress); toast.success("Copied!"); }} className="text-white/40 hover:text-white shrink-0">
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={() => setDeployedAddress(null)} className="px-8 py-3">Deploy Another</Button>
              <Button variant="outline" onClick={() => window.open(`https://basescan.org/address/${deployedAddress}`, '_blank')} className="px-8 py-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> View on BaseScan
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-white/80 block mb-3">Choose Contract Type</label>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setContractType('ERC20'); setFormData({ name: '', symbol: '', supply: '1000000' }); }} className={cn("p-6 rounded-2xl border-2 transition-all text-center", contractType === 'ERC20' ? "border-blue-500 bg-blue-600/20" : "border-white/10 bg-white/5 hover:border-white/20")}>
                  <div className="text-2xl font-bold mb-2">💰</div>
                  <div className="font-bold text-white">ERC-20 Token</div>
                  <div className="text-xs text-white/40 mt-1">Fungible Token</div>
                </button>
                <button onClick={() => { setContractType('ERC721'); setFormData({ name: '', symbol: '', supply: '1000000' }); }} className={cn("p-6 rounded-2xl border-2 transition-all text-center", contractType === 'ERC721' ? "border-blue-500 bg-blue-600/20" : "border-white/10 bg-white/5 hover:border-white/20")}>
                  <div className="text-2xl font-bold mb-2">🎨</div>
                  <div className="font-bold text-white">ERC-721 NFT</div>
                  <div className="text-xs text-white/40 mt-1">Non-Fungible Token</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60 font-bold">Name</label>
                <input placeholder={contractType === 'ERC20' ? "e.g. Base Nexus" : "e.g. Base Pass NFT"} className={cn("w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none", errors.name ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50")} value={formData.name} onChange={(e) => { setFormData({...formData, name: e.target.value}); if (errors.name) setErrors({...errors, name: ''}); }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 font-bold">Symbol</label>
                <input placeholder={contractType === 'ERC20' ? "e.g. NEXUS" : "e.g. BNP"} className={cn("w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none", errors.symbol ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50")} value={formData.symbol} onChange={(e) => { setFormData({...formData, symbol: e.target.value}); if (errors.symbol) setErrors({...errors, symbol: ''}); }} />
              </div>
            </div>

            {contractType === 'ERC20' && (
              <div className="space-y-2">
                <label className="text-sm text-white/60 font-bold">Initial Supply</label>
                <input type="number" placeholder="1,000,000" className={cn("w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none", errors.supply ? "border-red-500/50" : "border-white/10")} value={formData.supply} onChange={(e) => { setFormData({...formData, supply: e.target.value}); }} />
              </div>
            )}

            <Button className="w-full py-6 text-lg font-bold" onClick={handleDeploy} disabled={isDeploying || !userAddress}>
              {isDeploying ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Deploying...</> : <><Rocket className="w-5 h-5 mr-2" /> Deploy to Base Mainnet</>}
            </Button>
          </div>
        )}
      </GlassCard>

      <div className="space-y-6">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-blue-400" /> History</h3>
            {history.length > 0 && <button onClick={() => setHistory([])} className="text-[10px] text-white/20 hover:text-red-400">Clear</button>}
          </div>
          {history.length === 0 ? <p className="text-xs text-white/30 italic text-center py-8">No deployments yet</p> : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((item, idx) => (
                <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <div className="text-[10px] text-white/40">{item.symbol} • {item.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-400/60 font-mono truncate max-w-[150px]">{item.address}</span>
                    <a href={`https://basescan.org/address/${item.address}`} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white ml-auto"><ExternalLink className="w-3 h-3" /></a>
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
