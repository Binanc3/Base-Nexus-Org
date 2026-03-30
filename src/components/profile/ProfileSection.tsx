import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { User, Shield, Trophy, Repeat, Code2, ExternalLink, Copy, CheckCircle2, Zap, TrendingUp, Activity, Star, MessageSquare, Globe, Calendar, BarChart3, Award } from 'lucide-react';
import { useAccount } from 'wagmi';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import { cn } from '@/src/lib/utils';
import sdk from '@farcaster/miniapp-sdk';
import { AchievementMint } from '../achievements/AchievementMint';

interface UserStats {
  totalSwaps: number;
  totalVolume: string;
  contractsDeployed: number;
  totalMessages: number;
  totalCheckins: number;
  highScores: { game_id: string; score: number }[];
}

export function ProfileSection() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements'>('stats');
  const [context, setContext] = useState<any>();
  const [stats, setStats] = useState<UserStats>({
    totalSwaps: 0,
    totalVolume: '0',
    contractsDeployed: 0,
    totalMessages: 0,
    totalCheckins: 0,
    highScores: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getContext = async () => {
      try {
        const ctx = await sdk.context;
        setContext(ctx);
      } catch (e) {
        console.error("Error getting Farcaster context:", e);
      }
    };
    getContext();
  }, []);

  useEffect(() => {
    if (!address) return;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // 1. Get Swap Stats from LocalStorage (since we don't have a global indexer yet)
        const savedSwapStats = localStorage.getItem(`swap_stats_${address}`);
        const swapData = savedSwapStats ? JSON.parse(savedSwapStats) : { swapCount: 0, totalVolume: '0' };

        // 2. Fetch Deployment Count from Supabase
        const { count: deployCount } = await supabase
          .from('deployments')
          .select('*', { count: 'exact', head: true })
          .eq('user_address', address);

        // 3. Fetch High Scores from Supabase
        const { data: scoresData } = await supabase
          .from('leaderboards')
          .select('game_id, score')
          .eq('user_address', address)
          .order('score', { ascending: false });

        // Get highest score per game
        const highScoresMap: Record<string, number> = {};
        scoresData?.forEach(s => {
          if (!highScoresMap[s.game_id] || s.score > highScoresMap[s.game_id]) {
            highScoresMap[s.game_id] = s.score;
          }
        });
        const highScores = Object.entries(highScoresMap).map(([game_id, score]) => ({ game_id, score }));

        // 4. Fetch Message Count from Supabase
        const { count: messageCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_address', address);

        // 5. Fetch Checkin Count from Supabase
        const { count: checkinCount } = await supabase
          .from('checkins')
          .select('*', { count: 'exact', head: true })
          .eq('user_address', address);

        setStats({
          totalSwaps: swapData.swapCount,
          totalVolume: swapData.totalVolume,
          contractsDeployed: deployCount || 0,
          totalMessages: messageCount || 0,
          totalCheckins: checkinCount || 0,
          highScores
        });
      } catch (error) {
        console.error("Error fetching profile stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [address]);

  if (!address) return null;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <GlassCard className="p-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -mr-32 -mt-32" />
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 overflow-hidden">
              {context?.user?.pfpUrl ? (
                <img src={context.user.pfpUrl} alt="PFP" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                {context?.user?.displayName || context?.user?.username || 'Onchain Identity'}
              </h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                {context?.user?.username && (
                  <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-bold text-purple-400 flex items-center gap-2">
                    @{context.user.username}
                  </div>
                )}
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl font-mono text-sm text-blue-400 flex items-center gap-2">
                  {address.substring(0, 8)}...{address.substring(34)}
                  <button onClick={() => navigator.clipboard.writeText(address)} className="hover:text-white transition-colors">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <Button 
                  variant="outline" 
                  className="text-xs h-9 gap-2"
                  onClick={() => window.open(`https://basescan.org/address/${address}`, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                  BaseScan
                </Button>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-2xl font-bold text-white">{stats.totalSwaps + stats.contractsDeployed + stats.totalMessages}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Actions</div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Tab Switcher */}
      <div className="flex gap-4 mb-8">
        <Button 
          variant={activeTab === 'stats' ? 'primary' : 'outline'}
          className="flex-1 h-12 gap-2"
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 className="w-4 h-4" />
          Statistics
        </Button>
        <Button 
          variant={activeTab === 'achievements' ? 'primary' : 'outline'}
          className="flex-1 h-12 gap-2"
          onClick={() => setActiveTab('achievements')}
        >
          <Trophy className="w-4 h-4" />
          Achievements
        </Button>
      </div>

      {activeTab === 'stats' ? (
        <>
          {/* Stats Grid */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <motion.div variants={item}>
              <GlassCard className="p-6 h-full bg-blue-600/5 border-blue-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Repeat className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-white">Swap Activity</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Total Swaps</span>
                    <span className="text-lg font-bold text-white">{stats.totalSwaps}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Volume</span>
                    <span className="text-lg font-bold text-blue-400">${Number(stats.totalVolume).toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-green-400 font-bold uppercase tracking-wider">
                      <TrendingUp className="w-3 h-3" />
                      Active Trader
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div variants={item}>
              <GlassCard className="p-6 h-full bg-purple-600/5 border-purple-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Code2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="font-bold text-white">Developer Stats</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Contracts Deployed</span>
                    <span className="text-lg font-bold text-white">{stats.contractsDeployed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Factory Usage</span>
                    <span className="text-lg font-bold text-purple-400">{stats.contractsDeployed > 0 ? 'Active' : 'Idle'}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                      <Zap className="w-3 h-3" />
                      Base Builder
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div variants={item}>
              <GlassCard className="p-6 h-full bg-yellow-600/5 border-yellow-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h3 className="font-bold text-white">Gaming Profile</h3>
                </div>
                <div className="space-y-3">
                  {stats.highScores.length === 0 ? (
                    <p className="text-xs text-white/30 italic py-4">No scores logged yet. Head to the Game Hub!</p>
                  ) : (
                    stats.highScores.map((hs, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-xs text-white/60">{hs.game_id}</span>
                        <span className="text-sm font-bold text-yellow-400">{hs.score}</span>
                      </div>
                    ))
                  )}
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
                      <Star className="w-3 h-3" />
                      Arcade Master
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div variants={item}>
              <GlassCard className="p-6 h-full bg-green-600/5 border-green-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="font-bold text-white">Social Presence</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Wall Posts</span>
                    <span className="text-lg font-bold text-white">{stats.totalMessages}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Check-ins</span>
                    <span className="text-lg font-bold text-green-400">{stats.totalCheckins}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-green-400 font-bold uppercase tracking-wider">
                      <Globe className="w-3 h-3" />
                      Onchain Voice
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>

          {/* Activity Feed Placeholder */}
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-white">Recent Activity</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">Profile Synced</p>
                    <p className="text-xs text-white/40">Your onchain activity has been updated successfully.</p>
                  </div>
                  <span className="text-[10px] text-white/20">Just now</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </>
      ) : (
        <AchievementMint 
          stats={{
            highScore: stats.highScores.length > 0 ? Math.max(...stats.highScores.map(s => s.score)) : 0,
            deployments: stats.contractsDeployed,
            checkins: stats.totalCheckins,
            volume: Number(stats.totalVolume)
          }} 
        />
      )}
    </div>
  );
}
