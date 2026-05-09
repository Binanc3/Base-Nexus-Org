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
    const fetchStats = async () => {
      const { data } = await supabase.from('checkins').select('*').eq('user_address', address).order('created_at', { ascending: false });
      if (!data) return;

      setTotalCheckins(data.length);
      const todayStr = new Date().toISOString().split('T')[0]; // Absolute UTC day

      const gmToday = data.find(c => c.checkin_type === 'GM' && c.created_at.startsWith(todayStr));
      const gnToday = data.find(c => c.checkin_type === 'GN' && c.created_at.startsWith(todayStr));

      setHasGM(!!gmToday);
      setHasGN(!!gnToday);

      // Unique Day Streak Calc
      const days = [...new Set(data.map(c => c.created_at.split('T')[0]))].sort((a,b) => (a < b ? 1 : -1));
      let strk = 0;
      let checkDate = new Date();
      for (const d of days) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (d === dStr) strk++;
        else break;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      setStreak(strk);
    };
    fetchStats();
  }, [address]);

  const handleCheckIn = async (type: 'GM' | 'GN') => {
    if (!address || isPending || !isConnected) return toast.error('Connect wallet');
    if (type === 'GM' && hasGM) return;
    if (type === 'GN' && hasGN) return;

    setIsPending(true);
    setPendingType(type);
    const tId = toast.loading(`Confirming ${type}...`);

    try {
      const finalData = appendBuilderCode(createLogData(type) as `0x${string}`);
      const hash = await sendTransactionAsync({ to: "0x000000000000000000000000000000000000dEaD", data: finalData, value: 0n });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      await supabase.from('checkins').insert([{ user_address: address, checkin_type: type, tx_hash: hash }]);

      if (type === 'GM') setHasGM(true);
      if (type === 'GN') setHasGN(true);
      setTotalCheckins(t => t + 1);
      if (type === 'GM' && !hasGN) setStreak(s => s + 1);

      toast.success(`${type} Etched on Base!`, { id: tId });
    } catch (err: any) {
      toast.error(err.message?.includes('funds') ? "Need gas." : "Failed.", { id: tId });
    } finally {
      setIsPending(false);
      setPendingType(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-6 text-center border-[#00F0FF]/20 bg-[#0a1224]">
          <Zap className="w-5 h-5 text-[#00F0FF] mx-auto mb-2" />
          <h3 className="text-xs uppercase font-bold text-zinc-500">Streak</h3>
          <div className="text-4xl font-black text-white">{streak}</div>
        </GlassCard>
        <GlassCard className="p-6 text-center border-[#B026FF]/20 bg-[#0a1224]">
          <Calendar className="w-5 h-5 text-[#B026FF] mx-auto mb-2" />
          <h3 className="text-xs uppercase font-bold text-zinc-500">Total</h3>
          <div className="text-4xl font-black text-white">{totalCheckins}</div>
        </GlassCard>
      </div>

      <GlassCard className="p-8 border-zinc-800 bg-[#050b14] text-center">
        <h2 className="text-2xl font-black text-white mb-6">Daily Verification</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button onClick={() => handleCheckIn('GM')} disabled={isPending || hasGM} className={`h-24 text-lg font-black transition-all ${hasGM ? 'bg-zinc-900 text-zinc-600' : 'bg-gradient-to-r from-[#00F0FF] to-blue-500 text-black shadow-[0_0_20px_rgba(0,240,255,0.3)]'}`}>
            {isPending && pendingType === 'GM' ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : hasGM ? <CheckCircle2 className="w-6 h-6 mx-auto text-green-500" /> : <Sun className="w-6 h-6 mx-auto mb-2" />}
            {hasGM ? 'GM Logged' : 'Good Morning'}
          </Button>
          <Button onClick={() => handleCheckIn('GN')} disabled={isPending || hasGN} className={`h-24 text-lg font-black transition-all ${hasGN ? 'bg-zinc-900 text-zinc-600' : 'bg-gradient-to-r from-[#B026FF] to-purple-600 text-white shadow-[0_0_20px_rgba(176,38,255,0.3)]'}`}>
            {isPending && pendingType === 'GN' ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : hasGN ? <CheckCircle2 className="w-6 h-6 mx-auto text-green-500" /> : <Moon className="w-6 h-6 mx-auto mb-2" />}
            {hasGN ? 'GN Logged' : 'Good Night'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
