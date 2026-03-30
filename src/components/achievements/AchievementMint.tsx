import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Trophy, Share2, Download, Loader2, CheckCircle2, Award, Star, Zap, Code } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { stringToHex } from 'viem';
import { BASE_BUILDER_CODE } from '../../lib/wagmi';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface Achievement {
  id: string;
  title: string;
  description: string;
  value: string | number;
  type: 'score' | 'deployment' | 'streak' | 'swap';
  icon: React.ReactNode;
  color: string;
}

export function AchievementMint({ stats }: { stats: any }) {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [isMinting, setIsMinting] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  const achievements: Achievement[] = [
    {
      id: 'high-score',
      title: 'Grandmaster Score',
      description: 'Achieved a legendary high score in Base Games.',
      value: stats.highScore || 0,
      type: 'score',
      icon: <Trophy className="w-6 h-6" />,
      color: 'from-yellow-400 to-orange-600'
    },
    {
      id: 'deployer',
      title: 'Architect of Base',
      description: 'Successfully deployed smart contracts onchain.',
      value: stats.deployments || 0,
      type: 'deployment',
      icon: <Code className="w-6 h-6" />,
      color: 'from-blue-400 to-indigo-600'
    },
    {
      id: 'streak',
      title: 'Daily Pioneer',
      description: 'Maintained a consistent check-in streak.',
      value: `${stats.checkins || 0} Days`,
      type: 'streak',
      icon: <Zap className="w-6 h-6" />,
      color: 'from-purple-400 to-pink-600'
    },
    {
      id: 'volume',
      title: 'Liquidity Legend',
      description: 'Facilitated significant volume on Base.',
      value: `$${stats.volume?.toFixed(2) || '0.00'}`,
      type: 'swap',
      icon: <Star className="w-6 h-6" />,
      color: 'from-green-400 to-emerald-600'
    }
  ];

  const handleMint = async (achievement: Achievement) => {
    if (!address || isMinting) return;

    setIsMinting(true);
    try {
      toast.loading(`Minting ${achievement.title}...`, { id: 'mint' });

      // Record the minting event onchain
      const mintData = `MINT_ACHIEVEMENT:${achievement.id}:${achievement.value}`;
      const hash = await sendTransactionAsync({
        to: '0x0000000000000000000000000000000000008021',
        value: 0n,
        data: `${stringToHex(mintData).replace('0x', '')}${BASE_BUILDER_CODE.replace('0x', '')}` as `0x${string}`,
      });

      toast.loading("Confirming achievement onchain...", { id: 'mint' });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      toast.success("Achievement Minted!", { 
        id: 'mint',
        description: `Your ${achievement.title} is now permanently recorded.`,
        icon: <CheckCircle2 className="w-4 h-4 text-green-400" />
      });
    } catch (error) {
      console.error("Minting failed:", error);
      toast.error("Minting Failed", { 
        id: 'mint',
        description: error instanceof Error ? error.message : "Failed to mint achievement."
      });
    } finally {
      setIsMinting(false);
    }
  };

  const shareToFarcaster = (achievement: Achievement) => {
    const text = `I just minted my ${achievement.title} on Base Builder! 🚀\n\nAchievement: ${achievement.description}\nValue: ${achievement.value}\n\nCheck it out on Base!`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {achievements.map((achievement) => (
          <motion.div
            key={achievement.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <GlassCard className="p-6 relative overflow-hidden group cursor-pointer" onClick={() => setSelectedAchievement(achievement)}>
              <div className={cn(
                "absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 blur-2xl -mr-16 -mt-16 transition-opacity group-hover:opacity-20",
                achievement.color
              )} />
              
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-3 rounded-2xl bg-gradient-to-br shadow-lg",
                  achievement.color
                )}>
                  {achievement.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{achievement.title}</h3>
                  <p className="text-xs text-white/40 mb-4">{achievement.description}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Value</p>
                      <p className="text-xl font-mono font-bold text-white">{achievement.value}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="text-xs py-1 h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMint(achievement);
                      }}
                      disabled={isMinting}
                    >
                      {isMinting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3 mr-1" />}
                      Mint NFT
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-1 border-white/20 overflow-hidden">
                <div className={cn(
                  "h-48 bg-gradient-to-br flex items-center justify-center relative",
                  selectedAchievement.color
                )}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                  <div className="relative p-6 bg-black/20 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
                    {selectedAchievement.icon}
                  </div>
                  <div className="absolute top-4 right-4">
                    <Award className="w-8 h-8 text-white/20" />
                  </div>
                </div>
                
                <div className="p-8 text-center">
                  <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mb-4">
                    Official Achievement
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedAchievement.title}</h2>
                  <p className="text-white/60 mb-8 max-w-sm mx-auto">{selectedAchievement.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Record</p>
                      <p className="text-2xl font-mono font-bold text-white">{selectedAchievement.value}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Network</p>
                      <p className="text-2xl font-bold text-blue-400">BASE</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 gap-2 h-12"
                      onClick={() => handleMint(selectedAchievement)}
                      disabled={isMinting}
                    >
                      {isMinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
                      Mint Achievement
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-2 h-12"
                      onClick={() => shareToFarcaster(selectedAchievement)}
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-2 h-12"
                    >
                      <Download className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
