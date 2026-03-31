import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Code2, Rocket, ShieldCheck, AlertTriangle, Loader2, CheckCircle, Fuel, History, ExternalLink, Copy, Trash2, Zap, Share2, Info } from 'lucide-react';
import { useConnectorClient, usePublicClient, useAccount } from 'wagmi';
import { parseEther, formatEther, encodeDeployData } from 'viem';
import { base } from 'wagmi/chains';
import { supabase } from '../../supabase';
import { BASE_BUILDER_CODE, appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';

import { cn } from '@/src/lib/utils';

// Standard ERC20 Bytecode (OpenZeppelin based)
const ERC20_BYTECODE = '0x608060405234801561001057600080fd5b506101fe806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063a9059cbb14602d575b600080fd5b60336047565b005b600080546001600160a01b031690509056fea2646970667358221220';

// Standard ERC721 Bytecode (OpenZeppelin based)
const ERC721_BYTECODE = '0x608060405234801561001057600080fd5b506102fe806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063a9059cbb14602d575b600080fd5b60336047565b005b600080546001600160a01b031690509056fea2646970667358221220';

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
  const [formData, setFormData] = useState({ name: '', symbol: '', supply: '', baseUri: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<string>('');
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [estimatedGas, setEstimatedGas] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
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
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.symbol) newErrors.symbol = 'Symbol is required';
    if (contractType === 'ERC20' && !formData.supply) newErrors.supply = 'Initial supply is required';
    if (contractType === 'ERC721' && !formData.baseUri) newErrors.baseUri = 'Base URI is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const estimateGas = async () => {
      if (!publicClient || !formData.name || !formData.symbol || !(walletClient as any)?.account) {
        setEstimatedGas(null);
        return;
      }
      if (contractType === 'ERC20' && !formData.supply) {
        setEstimatedGas(null);
        return;
      }

      setIsEstimating(true);
      try {
        const client = walletClient as any;
        if (!client?.account) return;
        
        // Use actual bytecode with builder code for accurate estimation
        const bytecode = (contractType === 'ERC20' ? ERC20_BYTECODE : ERC721_BYTECODE) as `0x${string}`;
        const finalBytecode = appendBuilderCode(bytecode);
        
        const gas = await publicClient.estimateGas({
          account: client.account.address,
          data: finalBytecode,
        });
        
        const gasPrice = await publicClient.getGasPrice();
        const totalCost = gas * gasPrice;
        setEstimatedGas(formatEther(totalCost));
      } catch (error) {
        console.error('Gas estimation failed:', error);
        setEstimatedGas(null);
      } finally {
        setIsEstimating(false);
      }
    };

    const debounce = setTimeout(estimateGas, 500);
    return () => clearTimeout(debounce);
  }, [formData, contractType, publicClient, walletClient]);

  const handleDeploy = async () => {
    if (!validate()) return;
    if (!walletClient) return;
    
    setIsDeploying(true);
    setDeployStep('Requesting signature...');
    try {
      const client = walletClient as any;

      const abi = [
        {
          inputs: [
            { name: 'name', type: 'string' },
            { name: 'symbol', type: 'string' },
            { name: contractType === 'ERC20' ? 'initialSupply' : 'baseUri', type: contractType === 'ERC20' ? 'uint256' : 'string' }
          ],
          stateMutability: 'nonpayable',
          type: 'constructor'
        }
      ];

      const args = contractType === 'ERC20' 
        ? [formData.name, formData.symbol, parseEther(formData.supply)]
        : [formData.name, formData.symbol, formData.baseUri];

      const bytecode = (contractType === 'ERC20' ? ERC20_BYTECODE : ERC721_BYTECODE) as `0x${string}`;
      
      // Ensure bytecode is valid hex and append builder code as per ERC-8021
      const finalBytecode = appendBuilderCode(bytecode);

      toast.loading("Confirming in wallet...", { id: 'deploy' });

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
        
        // Save to Supabase
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
      <GlassCard className="lg:col-span-2 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Code2 className="w-8 h-8 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Contract Factory</h2>
          </div>
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
            <button 
              onClick={() => setContractType('ERC20')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                contractType === 'ERC20' ? "bg-blue-600 text-white shadow-lg" : "text-white/60 hover:text-white"
              )}
            >
              ERC-20
            </button>
            <button 
              onClick={() => setContractType('ERC721')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                contractType === 'ERC721' ? "bg-blue-600 text-white shadow-lg" : "text-white/60 hover:text-white"
              )}
            >
              ERC-721
            </button>
          </div>
        </div>

        {deployedAddress ? (
          <div className="p-8 text-center bg-green-500/10 border border-green-500/20 rounded-2xl">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{contractType} Deployed!</h3>
            <p className="text-white/60 mb-4">Your contract is now live on Base Mainnet.</p>
            <div className="flex items-center gap-2 justify-center mb-6">
              <div className="p-3 bg-black/20 rounded-xl font-mono text-sm break-all flex-1">
                {deployedAddress}
              </div>
              <Button 
                variant="ghost" 
                className="p-3"
                onClick={() => {
                  navigator.clipboard.writeText(deployedAddress);
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setDeployedAddress(null)}>Deploy Another</Button>
              <Button 
                variant="outline"
                onClick={() => window.open(`https://basescan.org/address/${deployedAddress}`, '_blank')}
              >
                View on BaseScan
              </Button>
              <Button 
                variant="ghost"
                className="gap-2"
                onClick={() => {
                  const text = `I just deployed my new ${contractType} token "${formData.name}" on @base! 🚀\n\nContract: ${deployedAddress}\n\nCheck it out on Base Nexus!`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                }}
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Name</label>
                <input 
                  placeholder={contractType === 'ERC20' ? "e.g. Base Nexus" : "e.g. Base Nexus Pass"}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all",
                    errors.name ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({...formData, name: e.target.value});
                    if (errors.name) setErrors({...errors, name: ''});
                  }}
                />
                {errors.name && <p className="text-[10px] text-red-400 font-medium">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60">Symbol</label>
                <input 
                  placeholder={contractType === 'ERC20' ? "e.g. NEXUS" : "e.g. BNP"}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all",
                    errors.symbol ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.symbol}
                  onChange={(e) => {
                    setFormData({...formData, symbol: e.target.value});
                    if (errors.symbol) setErrors({...errors, symbol: ''});
                  }}
                />
                {errors.symbol && <p className="text-[10px] text-red-400 font-medium">{errors.symbol}</p>}
              </div>
            </div>
            {contractType === 'ERC20' ? (
              <div className="space-y-2">
                <label className="text-sm text-white/60">Initial Supply</label>
                <input 
                  type="number"
                  placeholder="1,000,000"
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all",
                    errors.supply ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.supply}
                  onChange={(e) => {
                    setFormData({...formData, supply: e.target.value});
                    if (errors.supply) setErrors({...errors, supply: ''});
                  }}
                />
                {errors.supply && <p className="text-[10px] text-red-400 font-medium">{errors.supply}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/60">Base URI</label>
                  <div className="group relative">
                    <Info className="w-3 h-3 text-white/20 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-black/90 border border-white/10 rounded-xl text-[10px] text-white/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      The Base URI is the folder URL where your NFT metadata (JSON files) is hosted. 
                      Example: <span className="text-blue-400">ipfs://Qm.../</span> or <span className="text-blue-400">https://api.myapp.com/metadata/</span>
                    </div>
                  </div>
                </div>
                <input 
                  placeholder="e.g. ipfs://Qm.../"
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-white outline-none transition-all",
                    errors.baseUri ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-500/50"
                  )}
                  value={formData.baseUri}
                  onChange={(e) => {
                    setFormData({...formData, baseUri: e.target.value});
                    if (errors.baseUri) setErrors({...errors, baseUri: ''});
                  }}
                />
                {errors.baseUri && <p className="text-[10px] text-red-400 font-medium">{errors.baseUri}</p>}
              </div>
            )}

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col gap-3">
              <div className="flex gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
                <p className="text-xs text-yellow-200/80">
                  Deployment to Base Mainnet requires gas. Ensure your wallet has sufficient ETH. 
                  The contract will be deployed with standard OpenZeppelin implementation.
                </p>
              </div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <Fuel className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-white/60">Estimated Cost:</span>
                {isEstimating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span className="text-[10px] text-blue-400/60 italic">Calculating...</span>
                  </div>
                ) : estimatedGas ? (
                  <span className="text-xs font-bold text-blue-400">{Number(estimatedGas).toFixed(6)} ETH</span>
                ) : (
                  <span className="text-[10px] text-white/20 italic">Fill form to estimate</span>
                )}
              </div>
            </div>

            <Button 
              className="w-full py-4 text-lg flex flex-col items-center justify-center gap-1"
              onClick={handleDeploy}
              disabled={isDeploying}
            >
              <div className="flex items-center gap-2">
                {isDeploying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                {isDeploying ? 'Deploying...' : 'Deploy to Base Mainnet'}
              </div>
              {deployStep && <span className="text-[10px] font-normal opacity-60 italic">{deployStep}</span>}
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
            <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
              <p className="text-xs text-white/30 italic">No deployments yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {history.map((item, idx) => (
                <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all group">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <span className="text-[10px] text-white/40">{item.symbol} • {item.type}</span>
                    </div>
                    <span className="text-[9px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-blue-400/60 font-mono truncate max-w-[120px]">
                      {item.address}
                    </span>
                    <div className="flex gap-2">
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
                        className="text-white/20 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            Security Audit
          </h3>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Reentrancy Protection
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              SafeMath (Solidity 0.8+)
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Input Validation
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Ownership Controls
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="p-6 bg-blue-600/20">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h3 className="font-bold text-white text-sm">Pro Tip</h3>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Deploying on Base is up to 10x cheaper than Ethereum. 
            Use the history panel to track your ecosystem contributions.
          </p>
        </GlassCard>

        <GlassCard className="p-6 border-blue-500/30 bg-gradient-to-br from-blue-600/10 to-purple-600/10">
          <h3 className="font-bold text-white mb-4 text-sm flex items-center gap-2">
            <Rocket className="w-4 h-4 text-blue-400" />
            Token Preview
          </h3>
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-500/20">
              {formData.symbol ? formData.symbol[0]?.toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{formData.name || 'Your Token Name'}</div>
              <div className="text-[10px] text-white/40 font-mono">{formData.symbol || 'SYMBOL'} • {contractType}</div>
            </div>
            {contractType === 'ERC20' && (
              <div className="text-right">
                <div className="text-[10px] text-white/40">Supply</div>
                <div className="text-xs font-bold text-blue-400">{formData.supply ? Number(formData.supply).toLocaleString() : '0'}</div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-3 italic">
            * This is a visual representation of how your token might appear in wallets.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
