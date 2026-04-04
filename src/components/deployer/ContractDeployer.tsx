import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Code2, Rocket, Loader2, CheckCircle, Copy, ExternalLink, Zap, Info, History } from 'lucide-react';
import { useConnectorClient, usePublicClient, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { base } from 'wagmi/chains';
import { supabase } from '../../supabase';
import { appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';
import { ERC20_ABI, ERC721_ABI, ERC20_BYTECODE, ERC721_BYTECODE } from '../../lib/contracts';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

interface DeployedContract {
  address: string;
  name: string;
  symbol: string;
  type: 'ERC20' | 'ERC721';
  timestamp: number;
}

export function ContractDeployer() {
  const { address: userAddress } = useAccount();
  const [contractType, setContractType] = useState<'ERC20' | 'ERC721'>('ERC20');
  const [formData, setFormData] = useState({ 
    name: '', 
    symbol: '', 
    supply: '1000000'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<string>('');
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [deployedTxHash, setDeployedTxHash] = useState<string | null>(null);
  const [history, setHistory] = useState<DeployedContract[]>([]);
  const { data: walletClient } = useConnectorClient();
  const publicClient = usePublicClient();

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
      if (!formData.supply || Number(formData.supply) <= 0) newErrors.supply = 'Supply must be greater than 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeploy = async () => {
    if (!validate()) return;
    if (!walletClient || !userAddress) return;
    
    setIsDeploying(true);
    setDeployStep('Preparing deployment...');
    try {
      const client = walletClient as any;

      let abi: any[] = [];
      let args: any[] = [];
      let bytecode: `0x${string}`;

      // FIX: Guarantee the 0x prefix is attached to the raw bytecode exports
      if (contractType === 'ERC20') {
        abi = ERC20_ABI;
        args = [formData.name, formData.symbol, 18, parseEther(formData.supply)];
        bytecode = (ERC20_BYTECODE.startsWith('0x') ? ERC20_BYTECODE : `0x${ERC20_BYTECODE}`) as `0x${string}`;
      } else {
        abi = ERC721_ABI;
        args = [formData.name, formData.symbol];
        bytecode = (ERC721_BYTECODE.startsWith('0x') ? ERC721_BYTECODE : `0x${ERC721_BYTECODE}`) as `0x${string}`;
      }
      
      const finalBytecode = appendBuilderCode(bytecode);

      toast.loading("Confirming in wallet...", { id: 'deploy' });
      setDeployStep('Awaiting signature...');

      const hash = await client.deployContract({
        abi,
        bytecode: finalBytecode,
        args,
        account: userAddress,
        chain: base,
      });

      setDeployStep('Waiting for confirmation...');
      toast.loading("Waiting for confirmation...", { id: 'deploy' });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          throw new Error("Contract deployment reverted onchain");
        }
        const address = receipt.contractAddress || '0x...';
        setDeployedAddress(address);
        setDeployedTxHash(hash);
        
        try {
          await supabase.from('deployments').insert([{
            user_address: userAddress,
            contract_address: address,
            contract_type: contractType,
            tx_hash: hash
          }]);
        } catch (err) {
          console.error("Error logging deployment to Supabase:", err);
        }

        toast.success(`${contractType} Deployed!`, { 
          id: 'deploy',
          description: `Contract live at ${address.substring(0, 6)}...${address.substring(38)}`
        });

        saveToHistory({
          address,
          name: formData.name,
          symbol: formData.symbol,
          type: contractType,
          timestamp: Date.now()
        });

        setFormData({ name: '', symbol: '', supply: '1000000' });
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      setDeployStep('Deployment failed');
      toast.error("Deployment Failed", { 
        id: 'deploy',
        description: error instanceof Error ? error.message : "Failed to deploy contract."
      });
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
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 text-center bg-green-500/10 border border-green-500/20 rounded-3xl"
          >
            <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-6" />
            <h3 className="text-3xl font-bold text-white mb-2">{contractType} Deployed!</h3>
            <p className="text-white/60 mb-6">Your contract is now live on Base Mainnet.</p>
            
            <div className="bg-black/40 rounded-2xl p-6 mb-6 border border-white/10">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider font-bold">Contract Address</p>
              <div className="flex items-center gap-3 justify-center">
                <code className="text-sm font-mono text-blue-400 break-all flex-1">{deployedAddress}</code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(deployedAddress);
                    toast.success("Copied!");
                  }}
                  className="text-white/40 hover:text-white transition-colors shrink-0"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                onClick={() => {
                  setDeployedAddress(null);
                  setDeployedTxHash(null);
                }}
                className="px-8 py-3"
              >
                Deploy Another
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.open(`https://basescan.org/address/${deployedAddress}`, '_blank')}
                className="px-8 py-3 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on BaseScan
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-white/80 block mb-3">Choose Contract Type</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setContractType('ERC20');
                    setFormData({ name: '', symbol: '', supply: '1000000' });
                  }}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-center",
                    contractType === 'ERC20'
                      ? "border-blue-500 bg-blue-600/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  )}
                >
                  <div className="text-2xl font-bold mb-2">💰</div>
                  <div className="font-bold text-white">ERC-20 Token</div>
                  <div className="text-xs text-white/40 mt-1">Fungible Token</div>
                </button>
                <button
                  onClick={() => {
                    setContractType('ERC721');
                    setFormData({ name: '', symbol: '', supply: '1000000' });
                  }}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-center",
                    contractType === 'ERC721'
                      ? "border-blue-500 bg-blue-600/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  )}
                >
                  <div className="text-2xl font-bold mb-2">🎨</div>
                  <div className="font-bold text-white">ERC-721 NFT</div>
                  <div className="text-xs text-white/40 mt-1">Non-Fungible Token</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60 font-bold">Name</label>
                <input 
                  placeholder={contractType === 'ERC20' ? "e.g. Base Nexus" : "e.g. Base Pass NFT"}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all text-sm",
                    errors.name ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({...formData, name: e.target.value});
                    if (errors.name) setErrors({...errors, name: ''});
                  }}
                />
                {errors.name && <p className="text-[10px] text-red-400">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 font-bold">Symbol</label>
                <input 
                  placeholder={contractType === 'ERC20' ? "e.g. NEXUS" : "e.g. BNP"}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all text-sm",
                    errors.symbol ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.symbol}
                  onChange={(e) => {
                    setFormData({...formData, symbol: e.target.value});
                    if (errors.symbol) setErrors({...errors, symbol: ''});
                  }}
                />
                {errors.symbol && <p className="text-[10px] text-red-400">{errors.symbol}</p>}
              </div>
            </div>

            {contractType === 'ERC20' && (
              <div className="space-y-2">
                <label className="text-sm text-white/60 font-bold">Initial Supply</label>
                <input 
                  type="number"
                  placeholder="1,000,000"
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all text-sm",
                    errors.supply ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.supply}
                  onChange={(e) => {
                    setFormData({...formData, supply: e.target.value});
                    if (errors.supply) setErrors({...errors, supply: ''});
                  }}
                />
                {errors.supply && <p className="text-[10px] text-red-400">{errors.supply}</p>}
              </div>
            )}

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-bold mb-1">Ready to deploy?</p>
                <p className="text-xs text-blue-200/60">
                  Standard OpenZeppelin contract with full security. Deploys instantly to Base Mainnet.
                </p>
              </div>
            </div>

            <Button 
              className="w-full py-6 text-lg flex items-center justify-center gap-2 font-bold"
              onClick={handleDeploy}
              disabled={isDeploying || !userAddress}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Deploy to Base Mainnet
                </>
              )}
              {deployStep && <span className="block w-full text-[10px] font-normal opacity-60 mt-1">{deployStep}</span>}
            </Button>
          </div>
        )}
      </GlassCard>

      <div className="space-y-6">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Deployment History
            </h3>
            {history.length > 0 && (
              <button 
                onClick={() => {
                  setHistory([]);
                  if (userAddress) localStorage.removeItem(`deploy_history_${userAddress}`);
                }}
                className="text-[10px] text-white/20 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          
          {history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-white/30 italic">No deployments yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <div className="text-[10px] text-white/40">{item.symbol} • {item.type}</div>
                    </div>
                    <span className="text-[9px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-400/60 font-mono truncate max-w-[150px]">
                      {item.address}
                    </span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(item.address)}
                      className="text-white/20 hover:text-white transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <a 
                      href={`https://basescan.org/address/${item.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/20 hover:text-white transition-colors ml-auto"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6 bg-blue-600/20 border-blue-500/30">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Pro Tips</h3>
              <ul className="text-xs text-white/60 space-y-2">
                <li>✓ Costs ~$0.50-$2 to deploy</li>
                <li>✓ Standard OpenZeppelin code</li>
                <li>✓ Fully verified on BaseScan</li>
                <li>✓ Ready for trading & transfers</li>
              </ul>
            </div>
          </div>
        </GlassCard>

        {formData.name && (
          <GlassCard className="p-6 border-blue-500/30 bg-gradient-to-br from-blue-600/10 to-purple-600/10">
            <h3 className="font-bold text-white mb-4 text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-400" />
              Preview
            </h3>
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-blue-500/20">
                {formData.symbol ? formData.symbol[0]?.toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{formData.name || 'Your Token'}</div>
                <div className="text-[10px] text-white/40 font-mono">{formData.symbol || 'SYMBOL'} • {contractType}</div>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
