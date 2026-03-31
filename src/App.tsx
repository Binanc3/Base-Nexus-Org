import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction, usePublicClient } from 'wagmi';
import sdk, { type Context } from '@farcaster/miniapp-sdk';
import { Web3Provider } from './components/Web3Provider';
import { Button, GlassCard } from './components/ui/GlassUI';
import { SlicingGame, EndlessRunner, NeonDefender } from './components/games/GameHub';
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
  const [context, setContext] = useState<any>();

  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await sdk.context;
        setContext(ctx);
        await sdk.actions.ready();
      } catch (e) {
        console.error("Farcaster SDK init failed:", e);
      }
    };
    init();

    // Detect if running inside an iframe (common for Mini Apps)
    if (window.self !== window.top) {
      setIsMiniApp(true);
    }

    // A more aggressive approach for webviews/mini-apps
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    // Prevent pull-to-refresh via touch events on the document
    let startY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].pageY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].pageY;
      const main = mainRef.current;
      const scrollTop = main ? main.scrollTop : (window.scrollY || document.documentElement.scrollTop);

      // If at the top and pulling down, prevent default (which triggers reload)
      if (scrollTop <= 0 && y > startY) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.style.overscrollBehavior = 'auto';
      document.documentElement.style.overscrollBehavior = 'auto';
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []); // Run once on mount

  const handleCloseApp = () => {
    // Standard way to signal to host app to close
    window.parent.postMessage({ type: 'close' }, '*');
    // Fallback for some environments
    window.close();
  };

  const isLoggingRef = useRef<Record<string, boolean>>({});

  const handleGameComplete = async (game: string, score: number) => {
    // Prevent double logging for the same game session
    const sessionKey = `${game}-${score}-${Date.now()}`;
    if (isLoggingRef.current[game]) return;
    isLoggingRef.current[game] = true;

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
      try {
        toast.loading("Logging score onchain...", { id: 'game-score' });
        
        const hash = await sendTransactionAsync({
          to: address, // Send to self to log data with attribution
          value: 0n,
          data: `0x${stringToHex(`SCORE:${score}`).replace('0x', '')}${BASE_BUILDER_CODE.replace('0x', '')}` as `0x${string}`,
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        toast.success("Score Logged Onchain!", { id: 'game-score' });
      } catch (err) {
        console.error("Onchain score logging failed:", err);
        toast.error("Onchain Logging Failed", { id: 'game-score' });
      } finally {
        // Allow logging again after a short delay or next game
        setTimeout(() => {
          isLoggingRef.current[game] = false;
        }, 2000);
      }
    } else {
      isLoggingRef.current[game] = false;
    }
  };

  useEffect(() => {
    const trackUser = async () => {
      if (address && isConnected) {
        try {
          // Check if user already checked in today or just log the connection
          await supabase.from('checkins').insert([{ 
            user_address: address,
            type: 'connection'
          }]);
        } catch (err) {
          // Ignore errors (e.g. if table doesn't exist or unique constraint)
          console.warn("User tracking failed:", err);
        }
      }
    };
    trackUser();
  }, [address, isConnected]);

  const [recentActions, setRecentActions] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecentActions = async () => {
      try {
        const [
          { data: checkins },
          { data: deployments },
          { data: scores }
        ] = await Promise.all([
          supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('leaderboards').select('*').order('created_at', { ascending: false }).limit(5)
        ]);

        const all = [
          ...(checkins?.map(c => ({ ...c, label: `Checked in: ${c.checkin_type}` })) || []),
          ...(deployments?.map(d => ({ ...d, label: `Deployed ${d.contract_type}` })) || []),
          ...(scores?.map(s => ({ ...s, label: `Scored ${s.score} in ${s.game_id}` })) || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

        setRecentActions(all);
      } catch (err) {
        console.error("Error fetching recent actions:", err);
      }
    };
    fetchRecentActions();
    const interval = setInterval(fetchRecentActions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const [hasPeeked, setHasPeeked] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    users: 0,
    actions: 0,
    games: 0,
    messages: 0
  });

  useEffect(() => {
    if (!hasPeeked && isMiniApp) {
      const nav = document.querySelector('.bottom-nav-scroll');
      if (nav) {
        setTimeout(() => {
          nav.scrollTo({ left: 40, behavior: 'smooth' });
          setTimeout(() => {
            nav.scrollTo({ left: 0, behavior: 'smooth' });
            setHasPeeked(true);
          }, 800);
        }, 1000);
      }
    }
  }, [isMiniApp, hasPeeked]);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        // Count unique users across ALL tables
        const [
          { data: leaderboardUsers },
          { data: messageUsers },
          { data: deployUsers },
          { data: checkinUsers }
        ] = await Promise.all([
          supabase.from('leaderboards').select('user_address'),
          supabase.from('messages').select('user_address'),
          supabase.from('deployments').select('user_address'),
          supabase.from('checkins').select('user_address')
        ]);

        const allAddresses = [
          ...(leaderboardUsers?.map(u => u.user_address) || []),
          ...(messageUsers?.map(u => u.user_address) || []),
          ...(deployUsers?.map(u => u.user_address) || []),
          ...(checkinUsers?.map(u => u.user_address) || [])
        ].filter(addr => addr && addr !== 'Guest');
        
        const uniqueUsers = new Set(allAddresses).size;

        const { count: gameCount } = await supabase.from('leaderboards').select('*', { count: 'exact', head: true });
        const { count: messageCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
        const { count: deployCount } = await supabase.from('deployments').select('*', { count: 'exact', head: true });
        const { count: checkinCount } = await supabase.from('checkins').select('*', { count: 'exact', head: true });

        setGlobalStats({
          users: uniqueUsers || 0,
          actions: (gameCount || 0) + (messageCount || 0) + (deployCount || 0) + (checkinCount || 0),
          games: gameCount || 0,
          messages: messageCount || 0
        });
      } catch (err) {
        console.error("Error fetching global stats:", err);
      }
    };
    fetchGlobalStats();
    const interval = setInterval(fetchGlobalStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
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
    <div className="h-[100dvh] bg-[#050b18] text-white flex flex-col lg:flex-row overflow-hidden">
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
          
          {isMiniApp && (
            <button
              onClick={handleCloseApp}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all mt-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Close App</span>
            </button>
          )}
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <nav 
          className="bg-black/80 backdrop-blur-3xl border-t border-white/10 px-6 py-4 flex justify-start items-center gap-10 overflow-x-auto no-scrollbar mask-fade-right bottom-nav-scroll"
          onScroll={(e) => {
            const target = e.currentTarget;
            if (target.scrollLeft > 20) {
              target.classList.remove('mask-fade-right');
            } else {
              target.classList.add('mask-fade-right');
            }
          }}
        >
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all shrink-0",
                activeTab === tab.id ? "text-blue-400 scale-110" : "text-white/40 hover:text-white/60"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-tight uppercase whitespace-nowrap">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="w-1 h-1 bg-blue-400 rounded-full mt-0.5"
                />
              )}
            </motion.button>
          ))}
        </nav>
        {/* Scroll Hint */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 lg:hidden">
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: [0, 1, 0], x: [10, 0, 10] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1"
          >
            <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">More</span>
            <div className="w-1 h-1 bg-blue-400 rounded-full blur-[1px]" />
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <main 
        ref={mainRef}
        className="flex-1 p-4 lg:p-8 overflow-y-auto relative pb-24 lg:pb-8 overscroll-none touch-pan-y"
      >
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-600/5 blur-[150px] pointer-events-none" />
        
        <header className="flex justify-between items-center mb-8 lg:mb-12 relative z-10 max-w-7xl mx-auto">
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

        <div className="relative z-10 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8 pb-12">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <GlassCard className="p-4 lg:p-6">
                      <h3 className="text-white/60 text-[9px] lg:text-[10px] uppercase tracking-widest font-bold mb-2">Total Users</h3>
                      <div className="text-xl lg:text-2xl font-bold text-white">{globalStats.users.toLocaleString()}</div>
                      <div className="text-[9px] lg:text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Connected Wallets
                      </div>
                    </GlassCard>
                    <GlassCard className="p-4 lg:p-6">
                      <h3 className="text-white/60 text-[9px] lg:text-[10px] uppercase tracking-widest font-bold mb-2">Total Actions</h3>
                      <div className="text-xl lg:text-2xl font-bold text-white">{globalStats.actions.toLocaleString()}</div>
                      <div className="text-[9px] lg:text-[10px] text-purple-400 mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Onchain Activity
                      </div>
                    </GlassCard>
                    <GlassCard className="p-4 lg:p-6">
                      <h3 className="text-white/60 text-[9px] lg:text-[10px] uppercase tracking-widest font-bold mb-2">Games Played</h3>
                      <div className="text-xl lg:text-2xl font-bold text-white">{globalStats.games.toLocaleString()}</div>
                      <div className="text-[9px] lg:text-[10px] text-yellow-400 mt-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Arcade Usage
                      </div>
                    </GlassCard>
                    <GlassCard className="p-4 lg:p-6">
                      <h3 className="text-white/60 text-[9px] lg:text-[10px] uppercase tracking-widest font-bold mb-2">Messages</h3>
                      <div className="text-xl lg:text-2xl font-bold text-white">{globalStats.messages.toLocaleString()}</div>
                      <div className="text-[9px] lg:text-[10px] text-green-400 mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Wall Posts
                      </div>
                    </GlassCard>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <GlassCard className="lg:col-span-2 p-6 overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
                      <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        Network Status
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-green-400/30 transition-colors">
                          <div className="text-[10px] text-white/40 uppercase mb-1 font-bold tracking-widest">Status</div>
                          <div className="flex items-center gap-2 text-green-400 font-bold">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Operational
                          </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-blue-400/30 transition-colors">
                          <div className="text-[10px] text-white/40 uppercase mb-1 font-bold tracking-widest">Chain</div>
                          <div className="text-white font-bold">Base Mainnet</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-purple-400/30 transition-colors">
                          <div className="text-[10px] text-white/40 uppercase mb-1 font-bold tracking-widest">Protocol</div>
                          <div className="text-blue-400 font-bold">ERC-8021</div>
                        </div>
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-white/5">
                        <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">Recent Activity Feed</h4>
                        <div className="space-y-3">
                          {recentActions.length === 0 ? (
                            <div className="text-center py-4 text-white/20 text-[10px] italic">No recent activity detected</div>
                          ) : (
                            recentActions.map((action, i) => (
                              <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                                  <span className="text-white/80">{action.label}</span>
                                </div>
                                <span className="text-white/20 font-mono">
                                  {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </GlassCard>
                    <GlassCard className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30">
                      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        Nexus Tip
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed mb-6">
                        Every action you take on BaseNexus—from playing games to posting on the wall—is logged onchain. 
                        Build your onchain reputation and track your progress in the Profile section!
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-xs text-white/60">Ecosystem Status</span>
                          <span className="text-xs font-bold text-green-400">Stable</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-xs text-white/60">Gas Price</span>
                          <span className="text-xs font-bold text-blue-400">Low</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="mt-6 text-xs text-blue-400 p-0 hover:bg-transparent w-full justify-start"
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
                      <SlicingGame 
                        onComplete={(s) => handleGameComplete('FruitNinja', s)} 
                        onExit={() => setActiveTab('dashboard')}
                      />
                    </GlassCard>
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-bold mb-4">Base Runner</h3>
                      <EndlessRunner 
                        onComplete={(s) => handleGameComplete('BaseRunner', s)} 
                        onExit={() => setActiveTab('dashboard')}
                      />
                    </GlassCard>
                  </div>
                  <GlassCard className="p-6 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold mb-4">Neon Defender</h3>
                    <NeonDefender 
                      onComplete={(s) => handleGameComplete('NeonDefender', s)} 
                      onExit={() => setActiveTab('dashboard')}
                    />
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
      <Toaster position="top-center" richColors theme="dark" />
      <MainApp />
    </Web3Provider>
  );
}
