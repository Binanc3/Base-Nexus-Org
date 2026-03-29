import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction } from 'wagmi';
import { Web3Provider } from './components/Web3Provider';
import { Button, GlassCard } from './components/ui/GlassUI';
import { SlicingGame, EndlessRunner, BaseInvaders } from './components/games/GameHub';
import { SwapSection } from './components/swap/SwapSection';
import { OnchainAI } from './components/ai/OnchainAI';
import { ContractDeployer } from './components/deployer/ContractDeployer';
import { CheckIn } from './components/checkin/CheckIn';
import { ProfileSection } from './components/profile/ProfileSection';
import { cn } from '@/src/lib/utils';
import { stringToHex } from 'viem';
import { BASE_BUILDER_CODE } from './lib/wagmi';
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
  Shield,
  Trophy,
  User,
  Sparkles,
  Globe,
  Zap,
  Activity
} from 'lucide-react';
import { BaseWall } from './components/social/BaseWall';
import { motion, AnimatePresence } from 'motion/react';

import { supabase } from './supabase';

function MainApp() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransaction } = useSendTransaction();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastScore, setLastScore] = useState<{ game: string; score: number } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const handleGameComplete = async (game: string, score: number) => {
    setLastScore({ game, score });
    
    // 1. Save to Supabase for Leaderboard
    try {
      const { error } = await supabase
        .from('leaderboards')
        .insert([
          { 
            game_id: game, 
            user_address: address || 'Guest', 
            score: score 
          }
        ]);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving to leaderboard:", error);
    }

    // 2. Log score onchain ONLY if connected
    if (address && isConnected) {
      const scoreData = stringToHex(`SCORE:${game}:${score}`);
      sendTransaction({
        to: address,
        value: 0n,
        data: `${scoreData}${BASE_BUILDER_CODE.replace('0x', '')}` as `0x${string}`,
      });
    }
  };

  const [globalStats, setGlobalStats] = useState({
    users: 0,
    actions: 0,
    games: 0,
    messages: 0
  });

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const { count: userCount } = await supabase.from('leaderboards').select('user_address', { count: 'exact', head: true });
        const { count: gameCount } = await supabase.from('leaderboards').select('*', { count: 'exact', head: true });
        const { count: messageCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
        const { count: deployCount } = await supabase.from('deployments').select('*', { count: 'exact', head: true });
        const { count: checkinCount } = await supabase.from('checkins').select('*', { count: 'exact', head: true });

        setGlobalStats({
          users: userCount || 0,
          actions: (gameCount || 0) + (messageCount || 0) + (deployCount || 0) + (checkinCount || 0),
          games: gameCount || 0,
          messages: messageCount || 0
        });
      } catch (err) {
        console.error("Error fetching global stats:", err);
      }
    };
    fetchGlobalStats();
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'games', label: 'Game Hub', icon: Gamepad2 },
    { id: 'swap', label: 'Swap', icon: Repeat },
    { id: 'ai', label: 'Base AI', icon: Sparkles },
    { id: 'deployer', label: 'Deployer', icon: Code2 },
    { id: 'checkin', label: 'GM/GN', icon: CheckCircle2 },
    { id: 'wall', label: 'Base Wall', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#050b18] text-white flex flex-col lg:flex-row">
      {/* Connect Modal Overlay */}
      <AnimatePresence>
        {showConnectModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <GlassCard className="max-w-md w-full p-8 text-center relative">
              <button 
                onClick={() => setShowConnectModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <LogOut className="w-5 h-5 rotate-180" />
              </button>
              <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
              <p className="text-white/60 mb-8 text-sm">Choose a wallet to unlock onchain features like Swaps, Wall Posts, and Score Logging.</p>
              <div className="space-y-3">
                {connectors.map((connector) => (
                  <Button 
                    key={connector.id} 
                    onClick={() => {
                      connect({ connector });
                      setShowConnectModal(false);
                    }}
                    className="w-full py-4 flex items-center justify-between px-6 group"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-blue-400" />
                      <span className="font-bold">{connector.name}</span>
                    </div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </Button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

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
          {isConnected ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 uppercase tracking-wider">Wallet</span>
                <Button variant="ghost" className="p-1 h-auto" onClick={() => disconnect()}>
                  <LogOut className="w-4 h-4 text-red-400" />
                </Button>
              </div>
              <p className="text-sm font-mono truncate">{address}</p>
            </>
          ) : (
            <Button 
              onClick={() => setShowConnectModal(true)}
              className="w-full py-2 text-sm flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </Button>
          )}
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
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <GlassCard className="p-6">
                      <h3 className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-2">Total Users</h3>
                      <div className="text-2xl font-bold text-white">{globalStats.users.toLocaleString()}</div>
                      <div className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Global Reach
                      </div>
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-2">Total Actions</h3>
                      <div className="text-2xl font-bold text-white">{globalStats.actions.toLocaleString()}</div>
                      <div className="text-[10px] text-purple-400 mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Onchain Activity
                      </div>
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-2">Games Played</h3>
                      <div className="text-2xl font-bold text-white">{globalStats.games.toLocaleString()}</div>
                      <div className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Arcade Usage
                      </div>
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-2">Messages</h3>
                      <div className="text-2xl font-bold text-white">{globalStats.messages.toLocaleString()}</div>
                      <div className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Base Wall Posts
                      </div>
                    </GlassCard>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <GlassCard className="lg:col-span-2 p-6">
                      <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        Network Status
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="text-[10px] text-white/40 uppercase mb-1">Status</div>
                          <div className="flex items-center gap-2 text-green-400 font-bold">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Live
                          </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="text-[10px] text-white/40 uppercase mb-1">Chain</div>
                          <div className="text-white font-bold">Base Mainnet</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="text-[10px] text-white/40 uppercase mb-1">Attribution</div>
                          <div className="text-blue-400 font-bold">ERC-8021</div>
                        </div>
                      </div>
                    </GlassCard>
                    <GlassCard className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30">
                      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        Nexus Tip
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed">
                        Every action you take on BaseNexus—from playing games to posting on the wall—is logged onchain. 
                        Build your onchain reputation and track your progress in the Profile section!
                      </p>
                      <Button 
                        variant="ghost" 
                        className="mt-4 text-xs text-blue-400 p-0 hover:bg-transparent"
                        onClick={() => setActiveTab('profile')}
                      >
                        View My Stats →
                      </Button>
                    </GlassCard>
                  </div>
                </div>
              )}

              {activeTab === 'games' && (
                <div className="space-y-8">
                  {lastScore && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-blue-500/20 border border-blue-500/40 p-4 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        <div>
                          <p className="text-sm text-blue-200">Last Score Logged Onchain</p>
                          <p className="font-bold">{lastScore.game}: {lastScore.score}</p>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-xs" onClick={() => setLastScore(null)}>Dismiss</Button>
                    </motion.div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-bold mb-4">Fruit Ninja</h3>
                      <SlicingGame onComplete={(s) => handleGameComplete('FruitNinja', s)} />
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-bold mb-4">Base Runner</h3>
                      <EndlessRunner onComplete={(s) => handleGameComplete('BaseRunner', s)} />
                    </GlassCard>
                  </div>
                  <GlassCard className="p-6 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold mb-4">Base Invaders</h3>
                    <BaseInvaders onComplete={(s) => handleGameComplete('BaseInvaders', s)} />
                  </GlassCard>
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

export default function App() {
  return (
    <Web3Provider>
      <MainApp />
    </Web3Provider>
  );
}
