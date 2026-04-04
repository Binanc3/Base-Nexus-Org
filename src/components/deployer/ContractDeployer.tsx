import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Code2, Rocket, Loader2, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { base } from 'wagmi/chains';
import { toast } from 'sonner';
import { ERC20_ABI, ERC721_ABI, ERC20_BYTECODE, ERC721_BYTECODE } from '../../lib/contracts';
import { appendBuilderCode } from '../../lib/wagmi';

export function ContractDeployer() {
  const { address: userAddress } = useAccount();
  const [contractType, setContractType] = useState<'ERC20' | 'ERC721'>('ERC20');
  const [formData, setFormData] = useState({ name: '', symbol: '', supply: '1000000' });
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  
  // FIX: Must use useWalletClient, useConnectorClient does not have deployContract
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const handleDeploy = async () => {
    if (!formData.name || !formData.symbol) return toast.error("Fill all fields");
    if (!walletClient || !userAddress || !publicClient) return toast.error("Connect wallet");
    
    setIsDeploying(true);
    const toastId = toast.loading('Preparing deployment...');

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
      
      // FIX: Force '0x' prefix before appending builder code
      const formattedBytecode = (rawBytecode.startsWith('0x') ? rawBytecode : `0x${rawBytecode}`) as `0x${string}`;
      const finalBytecode = appendBuilderCode(formattedBytecode);

      toast.loading("Awaiting wallet confirmation...", { id: toastId });

      const hash = await walletClient.deployContract({
        abi,
        bytecode: finalBytecode,
        args,
        account: userAddress,
        chain: base,
      });

      toast.loading("Waiting for network confirmation...", { id: toastId });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') throw new Error("Deployment reverted onchain");

      setDeployedAddress(receipt.contractAddress || '0x...');
      toast.success(`${contractType} Deployed!`, { id: toastId });

    } catch (error: any) {
      console.error(error);
      const msg = error.message?.includes('User rejected') ? "Cancelled in wallet" : "Deployment failed";
      toast.error(msg, { id: toastId });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <GlassCard className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <Code2 className="w-8 h-8 text-blue-400" />
          <h2 className="text-3xl font-bold text-white">Contract Deployer</h2>
        </div>

        {deployedAddress ? (
          <div className="text-center bg-green-500/10 p-8 rounded-3xl border border-green-500/20">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Contract Live!</h3>
            <code className="bg-black/40 p-4 rounded-xl text-blue-400 block mb-6 break-all">{deployedAddress}</code>
            <div className="flex justify-center gap-4">
               <Button onClick={() => setDeployedAddress(null)}>Deploy Another</Button>
               <Button variant="outline" onClick={() => window.open(`https://basescan.org/address/${deployedAddress}`)}>View on BaseScan</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setContractType('ERC20')} className={`p-4 border rounded-xl font-bold ${contractType === 'ERC20' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/60'}`}>ERC-20 Token</button>
                <button onClick={() => setContractType('ERC721')} className={`p-4 border rounded-xl font-bold ${contractType === 'ERC721' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/60'}`}>ERC-721 NFT</button>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <input placeholder="Name (e.g. Nexus)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" />
                <input placeholder="Symbol (e.g. NEX)" value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} className="bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" />
             </div>
             {contractType === 'ERC20' && (
                <input type="number" placeholder="Supply (e.g. 1000000)" value={formData.supply} onChange={e => setFormData({...formData, supply: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" />
             )}
             <Button onClick={handleDeploy} disabled={isDeploying || !userAddress} className="w-full py-5 text-lg font-bold mt-4">
                {isDeploying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Deploy to Base Mainnet'}
             </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
