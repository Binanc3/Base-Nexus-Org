import { useState, useEffect, useCallback } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { MessageSquare, Send, Loader2, User, Clock, ExternalLink } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/src/supabase';
import { createLogData, appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  user_address: string;
  created_at: string;
  tx_hash?: string;
}

export function BaseWall() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
      setMessages(data || []);
    } catch (err) {}
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !newMessage.trim() || !isConnected) return toast.error("Connect wallet to post");

    setIsPosting(true);
    const toastId = toast.loading("Confirm in wallet...");

    try {
      const hexData = createLogData(newMessage.trim());
      const finalData = appendBuilderCode(hexData as `0x${string}`);
      
      const txHash = await sendTransactionAsync({
        to: "0x000000000000000000000000000000000000dEaD", 
        data: finalData,
        value: 0n,
      });

      toast.loading("Verifying on Base...", { id: toastId });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });

      await supabase.from('messages').insert([{
        content: newMessage.trim(),
        user_address: address,
        user_id: address,
        tx_hash: txHash,
      }]);

      setNewMessage('');
      toast.success("Message etched on the Wall!", { id: toastId });
      fetchMessages();
      
    } catch (err: any) {
      console.error("Post Error:", err);
      let message = "Transaction failed";
      if (err.message?.toLowerCase().includes('insufficient funds')) {
         message = "Error: Need tiny Base ETH fraction for gas.";
      } else if (err.message?.includes('User rejected')) {
         message = "Transaction cancelled.";
      }
      toast.error(message, { id: toastId });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <GlassCard className="p-6">
        <form onSubmit={handlePost} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Base Wall</h2>
          </div>
          
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Leave an immutable message on the Base network..."
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none h-24"
            maxLength={280}
          />

          <div className="flex justify-between items-center">
            <p className="text-[10px] text-zinc-500 font-mono">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not Connected"}
            </p>
            <Button type="submit" disabled={isPosting || !newMessage.trim()} className="px-6">
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Post <Send className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
        </form>
      </GlassCard>

      <div className="space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
              <GlassCard className="p-4 border-zinc-800/50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <User className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {msg.user_address.slice(0, 6)}...{msg.user_address.slice(-4)}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-zinc-200 text-sm">{msg.content}</p>
                {msg.tx_hash && (
                  <a href={`https://basescan.org/tx/${msg.tx_hash}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] text-blue-400/60 hover:text-blue-400">
                    View on BaseScan <ExternalLink className="w-2 h-2" />
                  </a>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
