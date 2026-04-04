import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Sun, Moon, Calendar, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { createLogData, appendBuilderCode } from '../../lib/wagmi';
import { supabase } from '../../supabase';
import { toast } from 'sonner';

export function CheckIn() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [streak, setStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [hasGM, setHasGM] = useState(false);
  const [hasGN, setHasGN] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [pendingType, setPendingType] = useState<'GM' | 'GN' | null>(null);

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
            const diffDays = Math.floor((today.getTime() - lastCheckinDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              currentStreak = 1;
              const checkDate = new Date(lastCheckinDate);
              for (let i = 1; i < sortedDays.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1);
                if (sortedDays[i] === checkDate.getTime()) currentStreak++;
                else break;
              }
            }
          }
          setStreak(currentStreak);

          const gmToday = data.find(c => c.checkin_type === 'GM' && new Date(c.created_at).toDateString() === todayStr);
          const gnToday = data.find(c => c.checkin_type === 'GN' && new Date(c.created_at).toDateString() === todayStr);

          setHasGM(!!gmToday);
          setHasGN(!!gnToday);
        }
      } catch (err) {}
    };

    fetchCheckinStats();
  }, [address]);

  const handleCheckIn = async (type: 'GM' | 'GN') => {
    if (!address || isPending || !isConnected) return toast.error('Connect wallet first');
    if (type === 'GM' && hasGM) return toast.error('Already said GM today!');
    if (type === 'GN' && hasGN) return toast.error('Already said GN today!');

    setIsPending(true);
    setPendingType(type);
    const toastId = toast.loading(`Confirm ${type} in wallet…`);

    try {
      const hexData = createLogData(type);
      const finalData = appendBuilderCode(hexData as `0x${string}`);

      const hash = await sendTransactionAsync({
        to: "0x000000000000000000000000000000000000dEaD",
        data: finalData,
        value: 0n,
      });

      toast.loading('Confirming transaction...', { id: toastId });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });

      await supabase.from('checkins').insert([{ user_address: address, checkin_type: type, tx_hash: hash }]);

      if (type === 'GM') setHasGM(true);
      if (type === 'GN') setHasGN(true);
      if (type === 'GM' && !hasGN) setStreak(s => s + 1);
      setTotalCheckins(t => t + 1);

      toast.success(`${type} recorded successfully!`, { id: toastId });
    } catch (err: any) {
      let message = "Failed to complete check-in.";
      if (err.message?.toLowerCase().includes('insufficient funds')) {
         message = "Error: Need tiny Base ETH fraction for gas.";
      }
      toast.error(message, { id: toastId });
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
        <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Daily Check-in</h2>
        <p className="text-zinc-400 text-sm mb-8 relative z-10">Prove your presence on the Base network.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
          <Button
            onClick={() => handleCheckIn('GM')}
            disabled={isPending || hasGM}
            className={`h-24 flex flex-col items-center justify-center gap-2 text-lg font-bold transition-all duration-300 ${hasGM ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
          >
            {isPending && pendingType === 'GM' ? <Loader2 className="w-6 h-6 animate-spin" /> : hasGM ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Sun className="w-6 h-6" />}
            <span>Good Morning</span>
          </Button>

          <Button
            onClick={() => handleCheckIn('GN')}
            disabled={isPending || hasGN}
            className={`h-24 flex flex-col items-center justify-center gap-2 text-lg font-bold transition-all duration-300 ${hasGN ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
          >
            {isPending && pendingType === 'GN' ? <Loader2 className="w-6 h-6 animate-spin" /> : hasGN ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Moon className="w-6 h-6" />}
            <span>Good Night</span>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
