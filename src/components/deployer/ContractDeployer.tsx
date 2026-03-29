import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Code2, Rocket, ShieldCheck, AlertTriangle } from 'lucide-react';

export function ContractDeployer() {
  const [formData, setFormData] = useState({ name: '', symbol: '', supply: '' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      <GlassCard className="lg:col-span-2 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Code2 className="w-8 h-8 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">ERC-20 Token Factory</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/60">Token Name</label>
              <input 
                placeholder="e.g. Base Nexus"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50"
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/60">Symbol</label>
              <input 
                placeholder="e.g. NEXUS"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50"
                onChange={(e) => setFormData({...formData, symbol: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/60">Initial Supply</label>
            <input 
              type="number"
              placeholder="1,000,000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50"
              onChange={(e) => setFormData({...formData, supply: e.target.value})}
            />
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-200/80">
              Deployment to Base Mainnet requires gas. Ensure your wallet has sufficient ETH. 
              The contract will be deployed with standard OpenZeppelin implementation.
            </p>
          </div>

          <Button className="w-full py-4 text-lg flex items-center justify-center gap-2">
            <Rocket className="w-5 h-5" />
            Deploy to Base Mainnet
          </Button>
        </div>
      </GlassCard>

      <div className="space-y-6">
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
          <h3 className="font-bold text-white mb-2 text-sm">Builder Attribution</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            This transaction will include ERC-8021 Builder Code attribution, 
            supporting the Base ecosystem.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
