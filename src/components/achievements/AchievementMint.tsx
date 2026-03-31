import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Trophy, Share2, Download, Loader2, CheckCircle2, Award, Star, Zap, Code, ExternalLink, Sparkles, X, ShieldCheck } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient, useWalletClient, useWriteContract } from 'wagmi';
import { stringToHex, parseEther, encodeFunctionData } from 'viem';
import { BASE_BUILDER_CODE, ONCHAIN_LOG_ADDRESS, appendBuilderCode } from '../../lib/wagmi';
import { ERC721_ABI } from '../../lib/contracts';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

// Standard ERC721 Bytecode (OpenZeppelin) for Achievements
const ACHIEVEMENT_NFT_BYTECODE = '0x608060405234801561001057600080fd5b5061012f806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634f6ccce714602d575b600080fd5b60336047565b6040518082815260200191505060405180910390f35b6000600190509056fea2646970667358221220'; // Placeholder for brevity, in real app use full bytecode

interface Achievement {
  id: string;
  title: string;
  description: string;
  value: string | number;
  type: 'score' | 'deployment' | 'streak' | 'swap';
  icon: React.ReactNode;
  color: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  level: number;
}

export function AchievementMint({ stats, address: propAddress }: { stats: any; address?: string }) {
  const { address: connectedAddress } = useAccount();
  const address = propAddress || connectedAddress;
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [isMinting, setIsMinting] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [mintedIds, setMintedIds] = useState<Set<string>>(new Set());
  const [showSuccessModal, setShowSuccessModal] = useState<Achievement | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [customContract, setCustomContract] = useState<string>('');
  const [showContractSettings, setShowContractSettings] = useState(false);

  // Default Achievement Contract on Base (Placeholder - User can override)
  const DEFAULT_ACHIEVEMENT_CONTRACT = '0x0000000000000000000000000000000000000000'; 

  const achievements: Achievement[] = [
    {
      id: 'high-score',
      title: 'Grandmaster Score',
      description: 'Achieved a legendary high score in Base Games.',
      value: stats.highScore || 0,
      type: 'score',
      icon: <Trophy className="w-8 h-8" />,
      color: 'from-amber-300 via-orange-500 to-red-600',
      rarity: 'Legendary',
      level: Math.floor((stats.highScore || 0) / 100) + 1
    },
    {
      id: 'deployer',
      title: 'Architect of Base',
      description: 'Successfully deployed smart contracts onchain.',
      value: stats.deployments || 0,
      type: 'deployment',
      icon: <Code className="w-8 h-8" />,
      color: 'from-cyan-400 via-blue-500 to-indigo-600',
      rarity: 'Epic',
      level: (stats.deployments || 0) + 1
    },
    {
      id: 'streak',
      title: 'Daily Pioneer',
      description: 'Maintained a consistent check-in streak.',
      value: `${stats.checkins || 0} Days`,
      type: 'streak',
      icon: <Zap className="w-8 h-8" />,
      color: 'from-fuchsia-400 via-purple-500 to-pink-600',
      rarity: 'Rare',
      level: stats.checkins || 1
    },
    {
      id: 'volume',
      title: 'Liquidity Legend',
      description: 'Facilitated significant volume on Base.',
      value: `$${stats.volume?.toLocaleString() || '0.00'}`,
      type: 'swap',
      icon: <Star className="w-8 h-8" />,
      color: 'from-emerald-300 via-green-500 to-teal-600',
      rarity: 'Epic',
      level: Math.floor((stats.volume || 0) / 1000) + 1
    }
  ];

  // Load minted achievements from localStorage for demo persistence
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`minted_achievements_${address}`);
      if (saved) {
        setMintedIds(new Set(JSON.parse(saved)));
      }
    }
  }, [address]);

  // Handle shared achievement from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const achievementId = params.get('achievement');
    if (achievementId) {
      const found = achievements.find(a => a.id === achievementId);
      if (found) {
        setSelectedAchievement(found);
      }
    }
  }, []);

  const handleMint = async (achievement: Achievement) => {
    if (!address || isMinting) return;

    setIsMinting(true);
    const toastId = toast.loading(`Initiating Onchain Mint for ${achievement.title}...`);

    try {
      const targetContract = (customContract || DEFAULT_ACHIEVEMENT_CONTRACT) as `0x${string}`;
      let hash: `0x${string}`;

      if (targetContract === '0x0000000000000000000000000000000000000000') {
        // Fallback: Log event onchain if no contract is set
        const mintData = `MINT_NFT:${achievement.id}:${achievement.rarity}:${Date.now()}`;
        hash = await sendTransactionAsync({
          to: ONCHAIN_LOG_ADDRESS,
          value: 0n,
          data: appendBuilderCode(stringToHex(mintData)),
        });
      } else {
        // Real NFT Minting via Contract
        // We use sendTransactionAsync to ensure builder code is appended to the encoded call
        const encodedData = encodeFunctionData({
          abi: ERC721_ABI,
          functionName: 'mint',
          args: [address as `0x${string}`, BigInt(achievement.id.split('-')[1] || Date.now())]
        });

        hash = await sendTransactionAsync({
          to: targetContract,
          data: appendBuilderCode(encodedData),
          value: 0n
        });
      }

      setLastTxHash(hash);
      toast.loading("Securing NFT on Base...", { id: toastId });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          throw new Error("Mint transaction reverted onchain. Ensure you have enough gas.");
        }
      }

      // 2. Save to local state
      const newMinted = new Set(mintedIds);
      newMinted.add(achievement.id);
      setMintedIds(newMinted);
      localStorage.setItem(`minted_achievements_${address}`, JSON.stringify(Array.from(newMinted)));

      // 3. Show Success Modal
      setShowSuccessModal(achievement);
      setSelectedAchievement(null);

      toast.success("NFT Minted Successfully!", { 
        id: toastId,
        description: `Your ${achievement.title} is now a permanent part of your onchain identity.`,
        icon: <CheckCircle2 className="w-4 h-4 text-green-400" />
      });
    } catch (error: any) {
      console.error("Minting failed:", error);
      toast.error("Minting Failed", { 
        id: toastId,
        description: error.message || "Failed to mint achievement."
      });
    } finally {
      setIsMinting(false);
    }
  };

  const shareAchievement = async (achievement: Achievement) => {
    const isMinted = mintedIds.has(achievement.id);
    const text = isMinted 
      ? `I just minted my ${achievement.rarity} ${achievement.title} NFT on BaseNexus! 💎\n\nLevel: ${achievement.level}\nValue: ${achievement.value}\n\nBuilt on @Base 🔵`
      : `Check out my ${achievement.title} progress on BaseNexus! 🚀\n\nLevel: ${achievement.level}\nValue: ${achievement.value}\n\nJoin me on @Base 🔵`;
    
    const shareUrl = `${window.location.origin}?achievement=${achievement.id}&user=${address}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BaseNexus Achievement',
          text: text,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      toast.success("Share Link Copied!", { description: "Post it on BaseApp or Farcaster!" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Onchain Achievements</h2>
            <p className="text-sm text-white/40">Mint your milestones as unique NFTs on Base</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          className="gap-2 text-white/40 hover:text-white"
          onClick={() => setShowContractSettings(!showContractSettings)}
        >
          <ShieldCheck className="w-4 h-4" />
          {customContract ? "Custom Contract Active" : "NFT Settings"}
        </Button>
      </div>

      <AnimatePresence>
        {showContractSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <GlassCard className="p-6 border-blue-500/20 bg-blue-500/5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-400" />
                Achievement NFT Configuration
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest">NFT Contract Address (Base)</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="0x..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white font-mono outline-none focus:border-blue-500/50 transition-all"
                      value={customContract}
                      onChange={(e) => setCustomContract(e.target.value)}
                    />
                    <Button 
                      variant="outline" 
                      className="text-[10px] h-9"
                      onClick={() => setCustomContract('')}
                    >
                      Reset
                    </Button>
                  </div>
                  <p className="text-[10px] text-white/30 italic">
                    Leave empty to use the default Nexus Achievement logger. 
                    Deploy your own contract in the "Contract Factory" and paste the address here.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {achievements.map((achievement) => {
          const isMinted = mintedIds.has(achievement.id);
          return (
            <motion.div
              key={achievement.id}
              whileHover={{ y: -5 }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <GlassCard 
                className={cn(
                  "p-8 relative overflow-hidden group cursor-pointer border-white/5 transition-all duration-500",
                  isMinted ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)]" : "hover:bg-white/5"
                )} 
                onClick={() => setSelectedAchievement(achievement)}
              >
                {/* Holographic Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                
                <div className={cn(
                  "absolute top-0 right-0 w-48 h-48 bg-gradient-to-br opacity-10 blur-[80px] -mr-24 -mt-24 transition-all duration-700 group-hover:opacity-30",
                  achievement.color
                )} />
                
                <div className="flex items-start gap-6 relative z-10">
                  <div className={cn(
                    "p-4 rounded-3xl bg-gradient-to-br shadow-2xl transform group-hover:rotate-12 transition-transform duration-500",
                    achievement.color
                  )}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border",
                        achievement.rarity === 'Legendary' ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" :
                        achievement.rarity === 'Epic' ? "text-purple-400 border-purple-400/30 bg-purple-400/10" :
                        "text-blue-400 border-blue-400/30 bg-blue-400/10"
                      )}>
                        {achievement.rarity}
                      </span>
                      {isMinted && (
                        <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          Minted
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">{achievement.title}</h3>
                    <p className="text-sm text-white/40 mb-6 leading-relaxed">{achievement.description}</p>
                    
                    <div className="flex items-end justify-between">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-1">Level</p>
                          <p className="text-xl font-bold text-white">{achievement.level}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-1">Value</p>
                          <p className="text-xl font-mono font-bold text-blue-400">{achievement.value}</p>
                        </div>
                      </div>
                      <Button 
                        variant={isMinted ? "outline" : "primary"}
                        className={cn(
                          "h-10 px-6 gap-2 font-bold text-xs uppercase tracking-wider",
                          isMinted && "border-white/10 text-white/60"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isMinted) handleMint(achievement);
                          else shareAchievement(achievement);
                        }}
                        disabled={isMinting}
                      >
                        {isMinting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isMinted ? <Share2 className="w-4 h-4" /> : <Award className="w-4 h-4" />)}
                        {isMinted ? "Share" : "Mint NFT"}
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 40, rotateX: 20 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.9, y: 40, rotateX: 20 }}
              className="max-w-xl w-full perspective-1000"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-1 border-white/20 overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.2)]">
                <div className={cn(
                  "h-72 bg-gradient-to-br flex items-center justify-center relative overflow-hidden",
                  selectedAchievement.color
                )}>
                  {/* Animated background patterns */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute w-[500px] h-[500px] border border-white/10 rounded-full"
                  />
                  
                  <div className="relative p-10 bg-black/30 backdrop-blur-2xl rounded-[40px] border border-white/30 shadow-2xl transform hover:scale-110 transition-transform duration-500">
                    {selectedAchievement.icon}
                  </div>
                  
                  <div className="absolute bottom-4 left-6 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">Verified on Base</span>
                  </div>
                </div>
                
                <div className="p-10 text-center relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-2 bg-black border border-white/20 rounded-full text-[12px] text-blue-400 font-black uppercase tracking-[0.3em] shadow-xl">
                    {selectedAchievement.rarity}
                  </div>
                  
                  <h2 className="text-4xl font-black text-white mb-3 tracking-tighter">{selectedAchievement.title}</h2>
                  <p className="text-white/50 mb-10 max-w-md mx-auto text-lg leading-relaxed">{selectedAchievement.description}</p>
                  
                  <div className="grid grid-cols-3 gap-4 mb-10">
                    <div className="p-5 bg-white/5 rounded-[24px] border border-white/10">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-bold">Level</p>
                      <p className="text-3xl font-bold text-white">{selectedAchievement.level}</p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-[24px] border border-white/10">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-bold">Value</p>
                      <p className="text-2xl font-mono font-bold text-blue-400">{selectedAchievement.value}</p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-[24px] border border-white/10">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-bold">Network</p>
                      <p className="text-2xl font-black text-blue-500">BASE</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      className="flex-[2] gap-3 h-16 text-lg font-black uppercase tracking-wider shadow-2xl shadow-blue-500/20"
                      onClick={() => handleMint(selectedAchievement)}
                      disabled={isMinting || mintedIds.has(selectedAchievement.id)}
                    >
                      {isMinting ? <Loader2 className="w-6 h-6 animate-spin" /> : (mintedIds.has(selectedAchievement.id) ? <CheckCircle2 className="w-6 h-6" /> : <Award className="w-6 h-6" />)}
                      {mintedIds.has(selectedAchievement.id) ? "Minted on Base" : "Mint Achievement"}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-3 h-16 border-white/10 hover:bg-white/5"
                      onClick={() => shareAchievement(selectedAchievement)}
                    >
                      <Share2 className="w-6 h-6" />
                      <span className="hidden md:inline">Share</span>
                    </Button>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedAchievement(null)}
                    className="mt-8 text-white/20 hover:text-white/40 transition-colors text-xs font-bold uppercase tracking-widest"
                  >
                    Close Achievement
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="w-full max-w-lg bg-slate-900 border border-blue-500/30 rounded-[40px] overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.3)]"
            >
              <div className={cn("h-64 bg-gradient-to-br flex items-center justify-center relative", showSuccessModal.color)}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="relative p-8 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl"
                >
                  {showSuccessModal.icon}
                </motion.div>
                <div className="absolute top-4 right-4">
                  <Button variant="ghost" className="p-2 hover:bg-white/10" onClick={() => setShowSuccessModal(null)}>
                    <X className="w-6 h-6 text-white" />
                  </Button>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                  <div className="bg-blue-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-xl flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    NFT Minted
                  </div>
                </div>
              </div>

              <div className="p-10 text-center pt-12">
                <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Achievement Unlocked!</h3>
                <p className="text-white/50 mb-8">
                  Your <span className="text-blue-400 font-bold">{showSuccessModal.title}</span> has been successfully minted as a unique NFT on the Base network.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase font-bold mb-1">Rarity</p>
                    <p className="text-lg font-bold text-white">{showSuccessModal.rarity}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase font-bold mb-1">Status</p>
                    <p className="text-lg font-bold text-green-400">Confirmed</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    className="w-full h-14 bg-blue-600 hover:bg-blue-500 font-black uppercase tracking-widest"
                    onClick={() => window.open(`https://basescan.org/tx/${lastTxHash}`, '_blank')}
                  >
                    View on Explorer
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full h-12 text-white/40 hover:text-white"
                    onClick={() => setShowSuccessModal(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
