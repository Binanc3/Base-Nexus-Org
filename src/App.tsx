import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Web3Provider } from './components/Web3Provider';
import { Button, GlassCard } from './components/ui/GlassUI';
import { SlicingGame, EndlessRunner, TileMatch } from './components/games/GameHub';
import { SwapSection } from './components/swap/SwapSection';
import { OnchainAI } from './components/ai/OnchainAI';
import { ContractDeployer } from './components/deployer/ContractDeployer';
import { CheckIn } from './components/checkin/CheckIn';
import { cn } from '@/src/lib/utils';
import { 
  LayoutDashboard, 
  Gamepad2, 
  Repeat, 
  MessageSquare, 
  Code2, 
  CheckCircle2, 
  Wallet,
  LogOut,
  ExternalLink,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function MainApp() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'games', label: 'Game Hub', icon: Gamepad2 },
    { id: 'swap', label: 'Swap', icon: Repeat },
    { id: 'ai', label: 'Base AI', icon: MessageSquare },
    { id: 'deployer', label: 'Deployer', icon: Code2 },
    { id: 'checkin', label: 'GM/GN', icon: CheckCircle2 },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        </div>
        
        <GlassCard className="max-w-md w-full p-8 text-center relative z-10">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-blue-500/40">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">BaseNexus</h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            The ultimate workspace for the Base ecosystem. Games, swaps, AI, and developer tools in one glassmorphic interface.
          </p>
          <div className="space-y-3">
            {connectors.map((connector) => (
              <Button 
                key={connector.id} 
                onClick={() => connect({ connector })}
                className="w-full py-4 text-lg flex items-center justify-center gap-3"
              >
                <Wallet className="w-6 h-6" />
                Connect Wallet
              </Button>
            ))}
          </div>
          <p className="text-xs text-white/40 mt-6">
            By connecting, you agree to interact with the Base Mainnet.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050b18] text-white flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 border-r border-white/10 p-6 flex-col gap-8 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">BaseNexus</span>
        </div>

        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                activeTab === tab.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40 uppercase tracking-wider">Wallet</span>
            <Button variant="ghost" className="p-1 h-auto" onClick={() => disconnect()}>
              <LogOut className="w-4 h-4 text-red-400" />
            </Button>
          </div>
          <p className="text-sm font-mono truncate">{address}</p>
        </div>
      </aside>

      {/* Bottom Nav - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-2xl border-t border-white/10 px-2 py-3 flex justify-around items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === tab.id ? "text-blue-400" : "text-white/40"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto relative pb-24 lg:pb-8">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-600/5 blur-[150px] pointer-events-none" />
        
        <header className="flex justify-between items-center mb-8 lg:mb-12 relative z-10">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-sm lg:text-base text-white/40">Base Mainnet Workspace</p>
          </div>
          <div className="flex gap-2 lg:gap-4">
            <Button variant="outline" className="p-2 lg:px-4 lg:py-2 flex items-center gap-2 text-xs lg:text-sm">
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">BaseScan</span>
            </Button>
          </div>
        </header>

        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <GlassCard className="p-6">
                    <h3 className="text-white/60 text-sm mb-4">Network Status</h3>
                    <div className="flex items-center gap-2 text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="font-bold">Base Mainnet Active</span>
                    </div>
                  </GlassCard>
                  <GlassCard className="p-6">
                    <h3 className="text-white/60 text-sm mb-4">Builder Attribution</h3>
                    <div className="text-blue-400 font-bold">ERC-8021 Enabled</div>
                  </GlassCard>
                  <GlassCard className="p-6">
                    <h3 className="text-white/60 text-sm mb-4">Gas Strategy</h3>
                    <div className="text-white font-bold">Standard (Low Cost)</div>
                  </GlassCard>
                </div>
              )}

              {activeTab === 'games' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-bold mb-4">Fruit Slicer</h3>
                      <SlicingGame onComplete={(s) => console.log('Score:', s)} />
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-bold mb-4">Base Runner</h3>
                      <EndlessRunner onComplete={(s) => console.log('Score:', s)} />
                    </GlassCard>
                  </div>
                  <GlassCard className="p-6 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold mb-4">Tile Match</h3>
                    <TileMatch onComplete={(s) => console.log('Score:', s)} />
                  </GlassCard>
                </div>
              )}

              {activeTab === 'swap' && <SwapSection />}
              {activeTab === 'ai' && <OnchainAI />}
              {activeTab === 'deployer' && <ContractDeployer />}
              {activeTab === 'checkin' && <CheckIn />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <MainApp />
    </Web3Provider>
  );
}
