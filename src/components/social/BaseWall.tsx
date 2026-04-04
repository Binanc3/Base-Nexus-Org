import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { MessageSquare, Send } from 'lucide-react';
import { useAccount, useSendTransaction } from 'wagmi';
import { toast } from 'sonner';
import { createLogData } from '../../lib/wagmi';

export function BaseWall() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [message, setMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    if (!message.trim()) return;
    if (!address) return toast.error("Connect wallet to post");

    setIsPosting(true);
    const toastId = toast.loading("Confirming transaction...");

    try {
      const hexData = createLogData(`NEXUS_WALL:${message.trim()}`);

      // FIX: Send to user's own address to bypass Smart Wallet strictness on 0-value txs
      await sendTransactionAsync({
        to: address as `0x${string}`, 
        value: 0n,
        data: hexData
      });

      toast.success("Posted to Base!", { id: toastId });
      setMessage('');
    } catch (error: any) {
      console.error(error);
      const msg = error.message?.includes('User rejected') ? "Cancelled in wallet" : "Transaction failed";
      toast.error(msg, { id: toastId });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <MessageSquare className="w-8 h-8 text-blue-400" />
        <h2 className="text-3xl font-bold text-white">Base Wall</h2>
      </div>

      <GlassCard className="p-6">
        <textarea 
          placeholder="Leave an immutable message on the Base network..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500/50 min-h-[120px] resize-none mb-4"
        />
        <Button onClick={handlePost} disabled={isPosting || !message.trim()} className="w-full py-4 flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          {isPosting ? 'Writing to blockchain...' : 'Post Onchain'}
        </Button>
      </GlassCard>
    </div>
  );
}
