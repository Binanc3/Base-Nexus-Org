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
  const [pendingType, setPendingType] = useState<'GM' | 'GN' | null>(null);
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
          let currentStreak = 0;
          const today = new Date();
          const todayStr = today.toDateString();
          today.setHours(0, 0, 0, 0);

          const uniqueDays = new Set<number>();
          data.forEach(checkin => {
            const d = new Date(checkin.created_at);
            d.setHours(0, 0, 0, 0);
            uniqueDays.add(d.getTime());
          });

          const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);

          if (sortedDays.length > 0) {
            const lastCheckinDate = new Date(sortedDays[0]);
            const diffDays = Math.floor(
              (today.getTime() - lastCheckinDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDays <= 1) {
              currentStreak = 1;
              const checkDate = new Date(lastCheckinDate);
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

          const gmToday = data.find(
            c => c.checkin_type === 'GM' &&
            new Date(c.created_at).toDateString() === todayStr
          );
          const gnToday = data.find(
            c => c.checkin_type === 'GN' &&
            new Date(c.created_at).toDateString() === todayStr
          );

          setHasGM(!!gmToday);
          setHasGN(!!gnToday);

          if (gmToday || gnToday) {
            setLastAction(gmToday ? 'GM' : 'GN');
          }
        }
      } catch (err) {
        console.error('[CheckIn] Error fetching stats:', err);
      }
    };

    fetchCheckinStats();
  }, [address]);

  const handleCheckIn = async (type: 'GM' | 'GN') => {
    if (!address || isPending || !isConnected) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet first.',
      });
      return;
    }

    if (type === 'GM' && hasGM) {
      toast.error('Already said GM today!');
      return;
    }
    if (type === 'GN' && hasGN) {
      toast.error('Already said GN today!');
      return;
    }

    setIsPending(true);
    setPendingType(type);
    setError(null);

    try {
      const txData = createLogData(type) as `0x${string}`;
      toast.loading(`Confirm ${type} in wallet…`, { id: 'checkin' });

      const hash = await sendTransactionAsync({
        to: address as `0x${string}`,
        value: 0n,
        data: txData,
      });

      toast.loading('Confirming transaction...', { id: 'checkin' });
      
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
      }

      const { error: supabaseError } = await supabase
        .from('checkins')
        .insert([{ user_address: address, checkin_type: type, tx_hash: hash }]);

      if (supabaseError) {
        throw new Error(`Database error: ${supabaseError.message}`);
      }

      setLastAction(type);
      if (type === 'GM') setHasGM(true);
      if (type === 'GN') setHasGN(true);

      if (type === 'GM' && !hasGN) setStreak(s => s + 1);
      setTotalCheckins(t => t + 1);

      toast.success(`${type} recorded successfully!`, { id: 'checkin' });

    } catch (err: any) {
      console.error('[CheckIn Error]', err);
      let message = err.shortMessage || err.message || "Failed to complete check-in.";
      if (message.toLowerCase().includes('insufficient funds')) {
         message = "Insufficient Base ETH for gas fees.";
      }
      toast.error(message, { id: 'checkin' });
    } finally {
      setIsPending(false);
      setPendingType(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-6 text-center border-zinc-800/50 bg-gradient-to-br from-zinc-900/50 to-black/50">
          <div className="flex items-center justify-center gap-2 mb-2 text-zinc-400">
            <Zap className="w-4 h-4 text-yellow-500" />
            <h3 className="text-xs uppercase font-bold tracking-wider">Current Streak</h3>
          </div>
          <div className="text-4xl font-black text-white">{streak} <span className="text-lg text-zinc-500 font-normal">days</span></div>
        </GlassCard>

        <GlassCard className="p-6 text-center border-zinc-800/50 bg-gradient-to-br from-zinc-900/50 to-black/50">
          <div className="flex items-center justify-center gap-2 mb-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs uppercase font-bold tracking-wider">Total Check-ins</h3>
          </div>
          <div className="text-4xl font-black text-white">{totalCheckins}</div>
        </GlassCard>
      </div>

      <GlassCard className="p-8 border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-purple-500/5 pointer-events-none" />
        
        <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Daily Check-in</h2>
        <p className="text-zinc-400 text-sm mb-8 relative z-10">
          Prove your presence on the Base network. Good Morning or Good Night?
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm text-left">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
          <Button
            onClick={() => handleCheckIn('GM')}
            disabled={isPending || hasGM}
            className={`h-24 flex flex-col items-center justify-center gap-2 text-lg font-bold transition-all duration-300 ${
              hasGM 
                ? 'bg-zinc-800/50 text-zinc-500 border-zinc-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] border-blue-500/50 hover:-translate-y-1'
            }`}
          >
            {isPending && pendingType === 'GM' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : hasGM ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
            <span>Good Morning</span>
          </Button>

          <Button
            onClick={() => handleCheckIn('GN')}
            disabled={isPending || hasGN}
            className={`h-24 flex flex-col items-center justify-center gap-2 text-lg font-bold transition-all duration-300 ${
              hasGN 
                ? 'bg-zinc-800/50 text-zinc-500 border-zinc-700 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.2)] hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] border-purple-500/50 hover:-translate-y-1'
            }`}
          >
            {isPending && pendingType === 'GN' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : hasGN ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : (
              <Moon className="w-6 h-6" />
            )}
            <span>Good Night</span>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
