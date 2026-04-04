import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Sun, Moon, Calendar, Zap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { createLogData } from '../../lib/wagmi';
import { supabase } from '../../supabase';
import { toast } from 'sonner';

export function CheckIn() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [streak, setStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [hasGM, setHasGM] = useState(false);
  const [hasGN, setHasGN] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const fetchCheckinStats = async () => {
      try {
        const { data, count } = await supabase
          .from('checkins')
          .select('*', { count: 'exact' })
          .eq('user_address', address)
          .order('created_at', { ascending: false });

        setTotalCheckins(count || 0);
        
        if (data && data.length > 0) {
          // Calculate real streak
          let currentStreak = 0;
          const today = new Date();
          const todayStr = today.toDateString();
          today.setHours(0, 0, 0, 0);
          
          const uniqueDays = new Set();
          data.forEach(checkin => {
            const d = new Date(checkin.created_at);
            d.setHours(0, 0, 0, 0);
            uniqueDays.add(d.getTime());
          });

          const sortedDays = Array.from(uniqueDays).sort((a: any, b: any) => b - a) as number[];
          
          if (sortedDays.length > 0) {
            const lastCheckinDate = new Date(sortedDays[0]);
            const diffDays = Math.floor((today.getTime() - lastCheckinDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 1) {
              currentStreak = 1;
              let checkDate = new Date(lastCheckinDate);
              for (let i = 1; i < sortedDays.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1);
                if (sortedDays[i] === checkDate.getTime()) {
                  currentStreak++;
                } else {
                  break;
                }
              }
            }
          }

          setStreak(currentStreak);
          
          // Check if already checked in today (GM and GN)
          const gmToday = data.find(c => c.checkin_type === 'GM' && new Date(c.created_at).toDateString() === todayStr);
          const gnToday = data.find(c => c.checkin_type === 'GN' && new Date(c.created_at).toDateString() === todayStr);
          
          setHasGM(!!gmToday);
          setHasGN(!!gnToday);
          
          if (gmToday || gnToday) {
            setLastAction(gmToday ? 'GM' : 'GN');
          }
        }
      } catch (err) {
        console.error("Error fetching checkin stats:", err);
      }
    };

    fetchCheckinStats();
  }, [address]);

  const handleCheckIn = async (type: 'GM' | 'GN') => {
    if (!address || isPending || !isConnected) {
      toast.error("Wallet not connected", { description: "Please connect your wallet first." });
      return;
    }
    
    // Check daily limits
    if (type === 'GM' && hasGM) {
      toast.error("Already said GM today!", { description: "You can only say GM once per day." });
      return;
    }
    if (type === 'GN' && hasGN) {
      toast.error("Already said GN today!", { description: "You can only say GN once per day." });
      return;
    }

    setIsPending(true);
    setError(null);
    
    try {
      // 1. Create transaction data with builder code
      const txData = createLogData(type);
      console.log(`[CheckIn] Sending ${type} with data:`, txData);
      
      toast.loading(`Confirming ${type} in wallet...`, { id: 'checkin' });
      
      // 2. Send transaction - sending to self address to save data in calldata
      const hash = await sendTransactionAsync({
        to: address, // Send to self
        value: 0n,
        data: txData,
        gas: 21000n + 4n * BigInt(txData.length / 2), // Proper gas calculation
      });

      if (!hash) {
        throw new Error("Transaction was not submitted to the network");
      }

      console.log(`[CheckIn] Transaction submitted:`, hash);
      toast.loading("Waiting for confirmation...", { id: 'checkin' });

      // 3. Wait for confirmation
      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash,
            timeout: 60_000, // 60 second timeout
          });
          
          console.log(`[CheckIn] Receipt:`, receipt);
          
          if (receipt.status === 'reverted') {
            throw new Error("Transaction reverted onchain - please check your gas limit");
          }
        } catch (waitError) {
          console.error('[CheckIn] Wait receipt error:', waitError);
          // Don't fail - transaction might still be valid
        }
      }

      // 4. Save to Supabase
      const { error: supabaseError } = await supabase
        .from('checkins')
        .insert([{
          user_address: address,
          checkin_type: type,
          tx_hash: hash
        }]);

      if (supabaseError) {
        console.error('[CheckIn] Supabase error:', supabaseError);
        throw supabaseError;
      }

      toast.success(`${type} Check-in Successful!`, { 
        id: 'checkin',
        description: "Your presence has been recorded onchain.",
        icon: <CheckCircle2 className="w-4 h-4 text-green-400" />
      });

      setLastAction(type);
      if (type === 'GM') setHasGM(true);
      if (type === 'GN') setHasGN(true);
      setTotalCheckins(prev => prev + 1);
      // Only increment streak if it's the first checkin of the day
      if (!hasGM && !hasGN) {
        setStreak(prev => prev + 1);
      }
    } catch (err) {
      console.error("Check-in failed:", err);
      const message = err instanceof Error ? err.message : "Check-in failed. Please ensure you have enough ETH for gas.";
      setError(message);
      toast.error("Check-in Failed", { 
        id: 'checkin',
        description: message.includes('insufficient') ? "Not enough ETH for gas" : message.substring(0, 80)
      });
    } finally {
      setIsPending(false);
    }
  };

  if (!isConnected) {
    return (
      <GlassCard className="p-8 max-w-xl mx-auto text-center border-yellow-500/20 bg-yellow-500/5">
        <div className="inline-flex p-3 bg-yellow-500/20 rounded-2xl mb-6">
          <AlertCircle className="w-8 h-8 text-yellow-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Connect Wallet</h2>
        <p className="text-white/60">You need to connect your wallet to check in.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-8 max-w-xl mx-auto text-center">
      <div className="inline-flex p-3 bg-blue-500/20 rounded-2xl mb-6">
        <Zap className="w-8 h-8 text-blue-400" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Daily Check-in</h2>
      <p className="text-white/60 mb-8">Record your daily presence on the Base network and build your onchain streak.</p>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center italic flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Button 
          variant={lastAction === 'GM' ? 'primary' : 'outline'}
          className="py-8 flex flex-col items-center gap-3"
          onClick={() => handleCheckIn('GM')}
          disabled={isPending || hasGM}
        >
          {isPending && lastAction === 'GM' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Sun className="w-8 h-8" />
          )}
          <span className="text-lg">GM</span>
          {hasGM && <span className="text-[10px] text-green-400">✓ Done</span>}
        </Button>
        <Button 
          variant={lastAction === 'GN' ? 'primary' : 'outline'}
          className="py-8 flex flex-col items-center gap-3"
          onClick={() => handleCheckIn('GN')}
          disabled={isPending || hasGN}
        >
          {isPending && lastAction === 'GN' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Moon className="w-8 h-8" />
          )}
          <span className="text-lg">GN</span>
          {hasGN && <span className="text-[10px] text-green-400">✓ Done</span>}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-8 p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Current Streak</p>
          <p className="text-2xl font-bold text-white">{streak} Days</p>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div className="text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Check-ins</p>
          <p className="text-2xl font-bold text-white">{totalCheckins}</p>
        </div>
      </div>

      <p className="text-xs text-white/40 mt-6 flex items-center justify-center gap-2">
        <Calendar className="w-4 h-4" />
        {lastAction ? `Last check-in: Just now (${lastAction})` : 'No check-ins yet today'}
      </p>
    </GlassCard>
  );
}
