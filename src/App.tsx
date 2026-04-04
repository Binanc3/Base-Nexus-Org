import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction, usePublicClient } from 'wagmi';
import sdk from '@farcaster/miniapp-sdk';
import { Web3Provider } from './components/Web3Provider';
import { Button, GlassCard } from './components/ui/GlassUI';
import { SlicingGame, EndlessRunner } from './components/games/GameHub';
import { SwapSection } from './components/swap/SwapSection';
import { OnchainAI } from './components/ai/OnchainAI';
import { ContractDeployer } from './components/deployer/ContractDeployer';
import { CheckIn } from './components/checkin/CheckIn';
import { ProfileSection } from './components/profile/ProfileSection';
import { BaseWall } from './components/social/BaseWall';
import { cn } from '@/src/lib/utils';
import { createLogData } from './lib/wagmi';
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

  // 1. INITIALIZATION & MOBILE UX
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

  // 2. SCALABLE STATS & ACTIVITY FETCHING
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

  // 3. SECURE GAME COMPLETION LOGIC
  const isLoggingRef = useRef<boolean>(false);
  const handleGameComplete = async (game: string, score: number) => {
    if (isLoggingRef.current) return;
    isLoggingRef.current = true;

    setLastScore({ game, score });
    const toastId = 'game-score';

    if (address && isConnected) {
      try {
        toast.loading("Securing score on Base...", { id: toastId });
        const txData = createLogData(`SCORE:${game}:${score}`);

        const gas = await publicClient?.estimateGas({
          account: address,
          to: address,
          data: txData,
          value: 0n,
        }).catch(() => 35000n);

        const hash = await sendTransactionAsync({
          to: address,
          data: txData,
          gas: (gas! * 120n) / 100n,
        });

        if (publicClient && hash) {
          await publicClient.waitForTransactionReceipt({ hash, timeout: 30000 });
        }

        await supabase.from('leaderboards').insert([
          { game_id: game, user_address: address, score, tx_hash: hash }
        ]);

        toast.success("Score Immutable on Base!", { id: toastId });
      } catch (err) {
        toast.error("Logging failed - Saved as Guest", { id: toastId });
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

  return (
    <div className="h-[100dvh] bg-[#050b18] text-white flex flex-col lg:flex-row overflow-hidden">
      <AnimatePresence>
        {showConnectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <GlassCard className="max-w-md w-full p-8 text-center relative">
              <button onClick={() => setShowConnectModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/20"><Wallet className="w-8 h-8 text-white" /></div>
              <h2 className="text-2xl font-bold mb-2">Nexus Connect</h2>
              <p className="text-white/60 mb-8 text-sm">Join the Base ecosystem to log scores and deploy contracts.</p>
              <div className="space-y-3">
                {connectors.map((connector) => (
                  <Button key={connector.id} onClick={() => { connect({ connector }); setShowConnectModal(false); }} className="w-full py-4 flex items-center justify-between px-6 group">
                    <span className="font-bold">{connector.name}</span>
                    <Zap className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 border-r border-white/10 p-6 flex-col gap-8 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><Shield className="w-6 h-6" /></div>
          <span className="text-xl font-bold tracking-tight">BaseNexus</span>
        </div>
        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all", activeTab === tab.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-white/60 hover:bg-white/5 hover:text-white")}>
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
          {isConnected ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40 uppercase font-bold">Authenticated</span>
                <button onClick={() => disconnect()}><LogOut className="w-4 h-4 text-red-400" /></button>
              </div>
              <p className="text-xs font-mono truncate text-blue-400">{address}</p>
            </div>
          ) : (
            <Button onClick={() => setShowConnectModal(true)} className="w-full py-2 text-xs">Connect Wallet</Button>
          )}
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <span className="font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500" /> BaseNexus</span>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-white/5 rounded-lg">{mobileMenuOpen ? <X /> : <Menu />}</button>
      </div>

      <main ref={mainRef} className="flex-1 overflow-y-auto relative p-4 lg:p-8 pt-20 lg:pt-8 overscroll-none">
        <div className="max-w-7xl mx-auto relative z-10">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Live Users" value={globalStats.users} icon={Globe} color="text-blue-400" />
                    <StatCard label="Onchain Actions" value={globalStats.actions} icon={Zap} color="text-purple-400" />
                    <StatCard label="Arcade Plays" value={globalStats.games} icon={Trophy} color="text-yellow-400" />
                    <StatCard label="Wall Posts" value={globalStats.messages} icon={MessageSquare} color="text-green-400" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <GlassCard className="lg:col-span-2 p-6">
                      <h3 className="font-bold mb-6 flex items-center gap-2 text-white/60 text-sm uppercase tracking-widest"><Activity className="w-4 h-4" /> Live Feed</h3>
                      <div className="space-y-4">
                        {recentActions.map((action, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-white/80">{action.label}</span>
                            <span className="text-white/20 font-mono">{new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                    <GlassCard className="p-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20">
                      <h3 className="font-bold mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-400" /> Reputation</h3>
                      <p className="text-sm text-white/50 mb-6">Your onchain activity is logged to Base Mainnet, building your permanent reputation.</p>
                      <Button variant="outline" className="w-full text-xs" onClick={() => setActiveTab('profile')}>Analyze My Stats</Button>
                    </GlassCard>
                  </div>
                </div>
              )}

              {activeTab === 'games' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <GlassCard className="p-4"><h3 className="mb-4 font-bold">Fruit Ninja</h3><SlicingGame onComplete={(s) => handleGameComplete('FruitNinja', s)} onExit={() => setActiveTab('dashboard')} /></GlassCard>
                    <GlassCard className="p-4"><h3 className="mb-4 font-bold">Base Runner</h3><EndlessRunner onComplete={(s) => handleGameComplete('BaseRunner', s)} onExit={() => setActiveTab('dashboard')} /></GlassCard>
                  </div>
                </div>
              )}

              {activeTab === 'swap' && <SwapSection />}
              {activeTab === 'ai' && <OnchainAI />}
              {activeTab === 'deployer' && <ContractDeployer />}
              {activeTab === 'checkin' && <CheckIn />}
              {activeTab === 'profile' && <ProfileSection />}
              {activeTab === 'wall' && <BaseWall />}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <GlassCard className="p-4 lg:p-6">
      <h3 className="text-white/40 text-[10px] uppercase tracking-tighter font-bold mb-1">{label}</h3>
      <div className="text-xl lg:text-3xl font-bold mb-2">{value.toLocaleString()}</div>
      <div className={cn("flex items-center gap-1 text-[10px] font-bold", color)}>
        <Icon className="w-3 h-3" /> System Verified
      </div>
    </GlassCard>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <Toaster position="top-center" richColors theme="dark" />
      <MainApp />
    </Web3Provider>
  );
}
