import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction, usePublicClient } from 'wagmi';
import sdk from '@farcaster/miniapp-sdk';
import { Web3Provider } from './components/Web3Provider';
import { Button, GlassCard } from './components/ui/GlassUI';
import { SlicingGame, EndlessRunner, NeonDefender } from './components/games/GameHub';
import { SwapSection } from './components/swap/SwapSection';
import { OnchainAI } from './components/ai/OnchainAI';
import { ContractDeployer } from './components/deployer/ContractDeployer';
import { CheckIn } from './components/checkin/CheckIn';
import { ProfileSection } from './components/profile/ProfileSection';
import { BaseWall } from './components/social/BaseWall';
import { cn } from '@/src/lib/utils';
import { createLogData, appendBuilderCode } from './lib/wagmi';
import {
  LayoutDashboard, Gamepad2, Repeat, MessageSquare,
  Code2, CheckCircle2, Wallet, LogOut,
  Shield, Trophy, User, Sparkles, Globe, Zap,
  Activity, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { supabase } from './supabase';

function MainApp() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();

  const mainRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastScore, setLastScore] = useState<{ game: string; score: number } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ users: 0, actions: 0, games: 0, messages: 0 });

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        const ctx = await sdk.context;
        if (ctx) setIsMiniApp(true);
      } catch (e) {
        console.warn("Not running in Farcaster context");
      }
    };
    init();

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const refreshData = async () => {
      try {
        const [{ data: checkins }, { data: deployments }, { data: scores }] = await Promise.all([
          supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(3),
          supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(3),
          supabase.from('leaderboards').select('*').order('created_at', { ascending: false }).limit(3)
        ]);

        const combined = [
          ...(checkins?.map(c => ({ ...c, label: `GM: ${c.type}`, color: 'blue' })) || []),
          ...(deployments?.map(d => ({ ...d, label: `Deployed: ${d.contract_type}`, color: 'purple' })) || []),
          ...(scores?.map(s => ({ ...s, label: `Scored ${s.score} in ${s.game_id}`, color: 'yellow' })) || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

        setRecentActions(combined);

        const [usersCount, , gameCount, msgCount] = await Promise.all([
          supabase.rpc('get_unique_user_count'),
          supabase.from('leaderboards').select('*', { count: 'estimated', head: true }),
          supabase.from('leaderboards').select('*', { count: 'exact', head: true }).not('tx_hash', 'is', null),
          supabase.from('messages').select('*', { count: 'exact', head: true }).not('tx_hash', 'is', null)
        ]);

        setGlobalStats({
          users: (usersCount.data as number) || 0,
          actions: (gameCount.count || 0) + (msgCount.count || 0),
          games: gameCount.count || 0,
          messages: msgCount.count || 0
        });
      } catch (err) {
        console.error("Dashboard sync error:", err);
      }
    };

    refreshData();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  const isLoggingRef = useRef<boolean>(false);
  
  const handleGameComplete = async (game: string, score: number) => {
    if (isLoggingRef.current) return;
    isLoggingRef.current = true;

    setLastScore({ game, score });
    const toastId = 'game-score';

    if (address && isConnected) {
      try {
        toast.loading("Securing score on Base...", { id: toastId });
        
        const rawHex = createLogData(`SCORE:${game}:${score}`);
        const finalTxData = appendBuilderCode(rawHex as `0x${string}`);

        // Sending to a safe Burn EOA guarantees gas estimation succeeds for Smart Wallets
        const hash = await sendTransactionAsync({
          to: "0x000000000000000000000000000000000000dEaD", 
          data: finalTxData,
          value: 0n, 
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, timeout: 30000 });
        }

        await supabase.from('leaderboards').insert([{ game_id: game, user_address: address, score, tx_hash: hash }]);
        toast.success("Score Immutable on Base!", { id: toastId });

      } catch (err: any) {
        let msg = "Logging failed - Saved as Guest";
        if (err.message?.toLowerCase().includes('insufficient funds')) {
           msg = "Empty Wallet: Need tiny ETH fraction for gas.";
        }
        toast.error(msg, { id: toastId });
      }
    } else {
      await supabase.from('leaderboards').insert([{ game_id: game, user_address: 'Guest', score }]);
    }

    setTimeout(() => { isLoggingRef.current = false; }, 1000);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'games', label: 'Arcade', icon: Gamepad2 },
    { id: 'swap', label: 'Swap', icon: Repeat },
    { id: 'ai', label: 'Base AI', icon: Sparkles },
    { id: 'deployer', label: 'Deployer', icon: Code2 },
    { id: 'checkin', label: 'GM/GN', icon: CheckCircle2 },
    { id: 'wall', label: 'Wall', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const handleTabSelect = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-[100dvh] bg-[#050b18] text-white flex flex-col lg:flex-row overflow-hidden">
      <AnimatePresence>
        {showConnectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <GlassCard className="max-w-md w-full p-8 text-center relative">
              <button onClick={() => setShowConnectModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <Wallet className="w-16 h-16 text-blue-400 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
              <p className="text-white/60 mb-8 text-sm">Connect your smart wallet to interact with the Base network.</p>
              
              <div className="space-y-3">
                {connectors.map((connector) => (
                  <Button
                    key={connector.uid}
                    onClick={() => {
                      connect({ connector });
                      setShowConnectModal(false);
                    }}
                    className="w-full py-4 bg-white/5 hover:bg-blue-600/20 text-white border border-white/10 hover:border-blue-500/50 flex items-center justify-center gap-3"
                  >
                    <img 
                      src={connector.name.includes('Coinbase') ? 'https://docs.base.org/img/logo.svg' : 'https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.svg'} 
                      className="w-6 h-6 object-contain"
                      alt={connector.name}
                    />
                    {connector.name}
                  </Button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="lg:w-72 border-r border-white/5 bg-[#0a1224] flex flex-col z-50">
        <div className="p-6 flex items-center justify-between lg:justify-start gap-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white">Base Nexus</h1>
              <p className="text-[10px] text-blue-400 uppercase tracking-widest font-mono">Mainnet Active</p>
            </div>
          </div>
          <button 
            className="lg:hidden p-2 text-white/60 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div className={cn(
          "flex-1 overflow-y-auto py-6 px-4 space-y-2 lg:block absolute lg:static inset-0 top-[88px] bg-[#0a1224] lg:bg-transparent transition-transform duration-300",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-4 px-2">Ecosystem</div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                  activeTab === tab.id 
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" 
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5", activeTab === tab.id ? "text-blue-400" : "group-hover:scale-110 transition-transform")} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/5 bg-[#0a1224] lg:block hidden">
          {isConnected && address ? (
            <GlassCard className="p-4 bg-zinc-900/50 border-zinc-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-zinc-950">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Connected</p>
                  <p className="text-sm font-bold text-white truncate">{address.substring(0,6)}...{address.substring(38)}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full py-2 text-xs border-zinc-700 text-zinc-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                onClick={() => disconnect()}
              >
                <LogOut className="w-3 h-3 mr-2" /> Disconnect
              </Button>
            </GlassCard>
          ) : (
            <Button 
              className="w-full py-4 text-sm font-bold bg-white text-black hover:bg-zinc-200"
              onClick={() => setShowConnectModal(true)}
            >
              <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
            </Button>
          )}
        </div>
      </nav>

      <main 
        ref={mainRef}
        className="flex-1 overflow-y-auto relative bg-[#050b18]"
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none"></div>

        <div className="relative z-10 max-w-6xl mx-auto p-4 lg:p-8 pt-8">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">Welcome to Nexus</h2>
                  <p className="text-zinc-400">The premier ecosystem for Base network interaction.</p>
                </div>
                {!isConnected && (
                  <Button onClick={() => setShowConnectModal(true)} className="hidden lg:flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Connect Now
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Active Users', value: globalStats.users, icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Onchain Actions', value: globalStats.actions, icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { label: 'Games Played', value: globalStats.games, icon: Gamepad2, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { label: 'Wall Messages', value: globalStats.messages, icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
                ].map((stat, i) => (
                  <GlassCard key={i} className="p-6 border-zinc-800/50 hover:border-zinc-700 transition-colors">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", stat.bg)}>
                      <stat.icon className={cn("w-5 h-5", stat.color)} />
                    </div>
                    <div className="text-3xl font-black text-white mb-1">{stat.value.toLocaleString()}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold">{stat.label}</div>
                  </GlassCard>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GlassCard className="lg:col-span-2 p-6 border-zinc-800/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-400" /> Ecosystem Features
                    </h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {tabs.slice(1, 5).map((tab) => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/30 hover:bg-blue-900/10 transition-all text-left group"
                      >
                        <tab.icon className="w-6 h-6 text-zinc-400 group-hover:text-blue-400 mb-3 transition-colors" />
                        <h4 className="font-bold text-white mb-1">{tab.label}</h4>
                        <p className="text-xs text-zinc-500">Access {tab.label.toLowerCase()} tools directly on Base.</p>
                      </button>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-6 border-zinc-800/50 flex flex-col">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-6">
                    <Activity className="w-5 h-5 text-purple-400" /> Live Feed
                  </h3>
                  <div className="flex-1 space-y-4">
                    {recentActions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          action.color === 'blue' ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" :
                          action.color === 'purple' ? "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]" :
                          "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                        )} />
                        <div className="flex-1 truncate">
                          <span className="text-zinc-300">{action.label}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {recentActions.length === 0 && (
                      <div className="text-center text-zinc-500 text-sm mt-8">Waiting for activity...</div>
                    )}
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="space-y-8">
              {!lastScore ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  <GlassCard className="p-8 flex flex-col items-center text-center group hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => setLastScore({ game: 'FruitNinja', score: 0 })}>
                    <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Gamepad2 className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Base Ninja</h3>
                    <p className="text-zinc-400 mb-6 text-sm">Slice objects, avoid bombs. High scores are secured onchain.</p>
                    <Button className="w-full">Play Now</Button>
                  </GlassCard>

                  <GlassCard className="p-8 flex flex-col items-center text-center group hover:border-purple-500/50 transition-all cursor-pointer" onClick={() => setLastScore({ game: 'EndlessRunner', score: 0 })}>
                    <div className="w-20 h-20 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Trophy className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Base Runner</h3>
                    <p className="text-zinc-400 mb-6 text-sm">Jump the obstacles. Prove your reflexes on the Base network.</p>
                    <Button className="w-full bg-purple-600 hover:bg-purple-500">Play Now</Button>
                  </GlassCard>

                  <GlassCard className="p-8 flex flex-col items-center text-center group hover:border-pink-500/50 transition-all cursor-pointer md:col-span-2" onClick={() => setLastScore({ game: 'NeonDefender', score: 0 })}>
                    <div className="w-20 h-20 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Shield className="w-10 h-10 text-pink-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Neon Defender</h3>
                    <p className="text-zinc-400 mb-6 text-sm">Defend the core from incoming waves. Survive and secure your rank.</p>
                    <Button className="w-full max-w-sm bg-pink-600 hover:bg-pink-500">Play Now</Button>
                  </GlassCard>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  {lastScore.game === 'FruitNinja' && <SlicingGame onComplete={(score) => handleGameComplete('FruitNinja', score)} onExit={() => setLastScore(null)} />}
                  {lastScore.game === 'EndlessRunner' && <EndlessRunner onComplete={(score) => handleGameComplete('EndlessRunner', score)} onExit={() => setLastScore(null)} />}
                  {lastScore.game === 'NeonDefender' && <NeonDefender onComplete={(score) => handleGameComplete('NeonDefender', score)} onExit={() => setLastScore(null)} />}
                </div>
              )}
            </div>
          )}

          {activeTab === 'swap' && <SwapSection />}
          {activeTab === 'ai' && <OnchainAI />}
          {activeTab === 'deployer' && <ContractDeployer />}
          {activeTab === 'checkin' && <CheckIn />}
          {activeTab === 'wall' && <BaseWall />}
          {activeTab === 'profile' && <ProfileSection />}

        </div>
      </main>

      <Toaster theme="dark" position="bottom-right" toastOptions={{
        style: { background: '#0a1224', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }
      }}/>
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
