import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Gamepad2, Trophy, Activity, Medal } from 'lucide-react';
import { useAccount, useSendTransaction } from 'wagmi';
import { toast } from 'sonner';
import { createLogData } from '../../lib/wagmi';

export function GameHub() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [isLogging, setIsLogging] = useState(false);
  const [score, setScore] = useState(0);

  // Example game logic: simply increase score for the prototype
  const playArcade = () => {
    setScore(prev => prev + Math.floor(Math.random() * 100) + 10);
  };

  const handleSaveScore = async () => {
    if (!address) {
      toast.error("Wallet disconnected", { description: "Please connect your wallet to save scores." });
      return;
    }
    if (score === 0) {
      toast.error("Play a game first!", { description: "You need a score > 0 to save." });
      return;
    }

    setIsLogging(true);
    const toastId = toast.loading("Saving score to Base network...");

    try {
      // 1. Format the score log into hex data
      const hexData = createLogData(`NEXUS_ARCADE_SCORE:${score}`);

      // 2. AUDIT FIX: Send to SELF to bypass Smart Wallet 0-value dead address restrictions
      const hash = await sendTransactionAsync({
        to: address as `0x${string}`, // <--- Sending to self fixes the crash
        value: 0n,
        data: hexData,
      });

      toast.success("Score secured onchain!", { 
        id: toastId,
        description: `Transaction submitted successfully.`
      });
      
      // Reset score after saving
      setScore(0);
    } catch (error: unknown) {
      console.error('[GameHub Error]', error);
      let errorMessage = "Failed to save score.";
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = "Transaction cancelled in wallet.";
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = "Not enough Base ETH for gas.";
        }
      }
      toast.error("Score Save Failed", { id: toastId, description: errorMessage });
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Gamepad2 className="w-8 h-8 text-purple-400" />
        <h2 className="text-3xl font-bold text-white">Nexus Arcade</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Area */}
        <GlassCard className="p-8 flex flex-col items-center justify-center min-h-[300px] bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-8">
            {score} <span className="text-2xl text-white/50">PTS</span>
          </div>
          
          <div className="flex gap-4 w-full">
            <Button 
              onClick={playArcade}
              className="flex-1 py-4 text-lg bg-purple-600 hover:bg-purple-500 text-white"
            >
              Play Game
            </Button>
            <Button 
              onClick={handleSaveScore}
              disabled={isLogging || score === 0}
              variant="outline"
              className="flex-1 py-4 text-lg border-purple-500/50 hover:bg-purple-500/20"
            >
              {isLogging ? 'Saving...' : 'Save Score Onchain'}
            </Button>
          </div>
        </GlassCard>

        {/* Leaderboard/Stats Area */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Medal className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm font-bold text-white">Last Score</div>
                  <div className="text-xs text-white/50">Stored securely on Base</div>
                </div>
              </div>
              <div className="text-blue-400 font-mono text-sm">
                Active
              </div>
            </div>
            
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <h4 className="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Pro Tip
              </h4>
              <p className="text-xs text-blue-200/70">
                Saving your score securely logs it to the Base blockchain. Since we route it to your own wallet address, it completely bypasses smart wallet restrictions while keeping your data immutable!
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
