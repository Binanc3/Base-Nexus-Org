import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Award, Star, CheckCircle } from 'lucide-react';
import { useAccount, useSendTransaction } from 'wagmi';
import { toast } from 'sonner';
import { createLogData } from '../../lib/wagmi';

export function AchievementSystem() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const ACHIEVEMENTS = [
    { id: 1, title: 'First Swap', desc: 'Execute your first token swap on Nexus.', points: 100 },
    { id: 2, title: 'Deployer', desc: 'Deploy a smart contract via the dashboard.', points: 250 },
    { id: 3, title: 'Base Native', desc: 'Log your first onchain message.', points: 50 }
  ];

  const handleClaim = async (id: number, title: string) => {
    if (!address) {
      return toast.error("Connect wallet to claim achievements");
    }

    setClaimingId(id);
    const toastId = toast.loading(`Claiming "${title}"...`);

    try {
      const hexData = createLogData(`NEXUS_ACHIEVEMENT_CLAIMED:${id}`);

      // AUDIT FIX: Send to SELF to bypass Smart Wallet strictness
      const hash = await sendTransactionAsync({
        to: address as `0x${string}`, // <--- Sending to self
        value: 0n,
        data: hexData,
      });

      toast.success("Achievement Claimed!", { 
        id: toastId,
        description: `Verified on Base.`
      });
      
    } catch (error: unknown) {
      console.error('[Achievement Error]', error);
      let errorMessage = "Failed to claim.";
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = "Transaction cancelled.";
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = "Not enough Base ETH for gas.";
        }
      }
      toast.error("Claim Failed", { id: toastId, description: errorMessage });
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Award className="w-8 h-8 text-yellow-400" />
        <h2 className="text-3xl font-bold text-white">Nexus Achievements</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ACHIEVEMENTS.map((ach) => (
          <GlassCard key={ach.id} className="p-6 flex flex-col items-center text-center hover:border-yellow-500/30 transition-all">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{ach.title}</h3>
            <p className="text-xs text-white/50 mb-6 flex-1">{ach.desc}</p>
            
            <div className="w-full">
              <Button 
                onClick={() => handleClaim(ach.id, ach.title)}
                disabled={claimingId === ach.id}
                className="w-full py-3 bg-white/5 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20"
              >
                {claimingId === ach.id ? 'Claiming...' : `Claim ${ach.points} XP`}
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
