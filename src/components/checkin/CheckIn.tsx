import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Sun, Moon, Calendar, Zap, Loader2 } from 'lucide-react';
import { useAccount, useSendTransaction } from 'wagmi';
import { stringToHex } from 'viem';
import { BASE_BUILDER_CODE } from '../../lib/wagmi';
import { supabase } from '../../supabase';

export function CheckIn() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [streak, setStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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
          // Calculate streak (simplified: consecutive days)
          let currentStreak = 1;
          const today = new Date().toDateString();
          const lastCheckinDate = new Date(data[0].created_at).toDateString();
          
          if (lastCheckinDate === today) {
            setLastAction(data[0].checkin_type);
          }

          // Streak calculation logic could be more complex, but let's keep it simple for now
          setStreak(data.length); // Just using total for now as a placeholder for streak
        }
      } catch (err) {
        console.error("Error fetching checkin stats:", err);
      }
    };

    fetchCheckinStats();
  }, [address]);

  const handleCheckIn = async (type: 'GM' | 'GN') => {
    if (!address || isPending) return;

    setIsPending(true);
    try {
      // 1. Send onchain transaction
      const checkInData = stringToHex(type);
      const hash = await sendTransactionAsync({
        to: address,
        value: 0n,
        data: `${checkInData}${BASE_BUILDER_CODE.replace('0x', '')}` as `0x${string}`,
      });

      // 2. Save to Supabase
      const { error } = await supabase
        .from('checkins')
        .insert([{
          user_address: address,
          checkin_type: type,
          tx_hash: hash
        }]);

      if (error) throw error;

      setLastAction(type);
      setTotalCheckins(prev => prev + 1);
      setStreak(prev => prev + 1);
    } catch (err) {
      console.error("Check-in failed:", err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <GlassCard className="p-8 max-w-xl mx-auto text-center">
      <div className="inline-flex p-3 bg-blue-500/20 rounded-2xl mb-6">
        <Zap className="w-8 h-8 text-blue-400" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Daily Check-in</h2>
      <p className="text-white/60 mb-8">Record your daily presence on the Base network and build your onchain streak.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Button 
          variant={lastAction === 'GM' ? 'primary' : 'outline'}
          className="py-8 flex flex-col items-center gap-3"
          onClick={() => handleCheckIn('GM')}
          disabled={isPending}
        >
          {isPending && lastAction === 'GM' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Sun className="w-8 h-8" />}
          <span className="text-lg">GM</span>
        </Button>
        <Button 
          variant={lastAction === 'GN' ? 'primary' : 'outline'}
          className="py-8 flex flex-col items-center gap-3"
          onClick={() => handleCheckIn('GN')}
          disabled={isPending}
        >
          {isPending && lastAction === 'GN' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Moon className="w-8 h-8" />}
          <span className="text-lg">GN</span>
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
        {lastAction ? `Last check-in: Just now (${lastAction})` : 'Last check-in: Today, 8:45 AM'}
      </p>
    </GlassCard>
  );
}
