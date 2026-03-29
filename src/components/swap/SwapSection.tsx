import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { ArrowDownUp, Settings, Info } from 'lucide-react';

export function SwapSection() {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('0.0');

  return (
    <GlassCard className="p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Swap</h2>
        <div className="flex gap-2">
          <Button variant="ghost" className="p-2"><Settings className="w-5 h-5" /></Button>
          <Button variant="ghost" className="p-2"><Info className="w-5 h-5" /></Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex justify-between text-sm text-white/60 mb-2">
            <span>From</span>
            <span>Balance: 1.25 ETH</span>
          </div>
          <div className="flex justify-between items-center">
            <input 
              type="number" 
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="bg-transparent text-2xl text-white outline-none w-full"
            />
            <Button variant="secondary" className="flex items-center gap-2">
              <img src="https://cryptologos.cc/logos/ethereum-eth-logo.png" className="w-5 h-5" alt="ETH" />
              ETH
            </Button>
          </div>
        </div>

        <div className="flex justify-center -my-3 relative z-10">
          <Button variant="secondary" className="p-2 rounded-full border border-white/20">
            <ArrowDownUp className="w-5 h-5" />
          </Button>
        </div>

        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex justify-between text-sm text-white/60 mb-2">
            <span>To</span>
            <span>Balance: 0.0 USDC</span>
          </div>
          <div className="flex justify-between items-center">
            <input 
              type="number" 
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="bg-transparent text-2xl text-white outline-none w-full"
            />
            <Button variant="secondary" className="flex items-center gap-2">
              <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" className="w-5 h-5" alt="USDC" />
              USDC
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-sm text-blue-200">
        <div className="flex justify-between mb-1">
          <span>Exchange Rate</span>
          <span>1 ETH = 2,450.20 USDC</span>
        </div>
        <div className="flex justify-between">
          <span>Slippage Tolerance</span>
          <span>0.5%</span>
        </div>
      </div>

      <Button className="w-full mt-6 py-4 text-lg">Swap via LI.FI</Button>
      
      <p className="text-center text-xs text-white/40 mt-4">
        Optimized routing powered by Jumper & LI.FI SDK
      </p>
    </GlassCard>
  );
}
