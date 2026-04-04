import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { MapPin, Calendar } from 'lucide-react';
import { useAccount, useSendTransaction } from 'wagmi';
import { toast } from 'sonner';
import { createLogData } from '../../lib/wagmi';

export function CheckIn() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const handleCheckIn = async () => {
    if (!address) return toast.error("Connect wallet first");

    setIsCheckingIn(true);
    const toastId = toast.loading("Logging check-in...");

    try {
      const date = new Date().toISOString().split('T')[0];
      const hexData = createLogData(`NEXUS_CHECKIN:${date}`);

      // FIX: Send to user's own address
      await sendTransactionAsync({
        to: address as `0x${string}`,
        value: 0n,
        data: hexData
      });

      toast.success("Checked in successfully!", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error("Check-in failed", { id: toastId });
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto text-center space-y-6">
      <GlassCard className="p-10">
        <MapPin className="w-16 h-16 text-blue-400 mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-white mb-2">Daily Onchain Check-in</h2>
        <p className="text-white/60 mb-8">Prove your active streak securely on the Base network.</p>
        
        <Button onClick={handleCheckIn} disabled={isCheckingIn} className="w-full py-6 text-xl font-bold flex items-center justify-center gap-3">
          <Calendar className="w-6 h-6" />
          {isCheckingIn ? 'Recording...' : 'Check In Now'}
        </Button>
      </GlassCard>
    </div>
  );
}
