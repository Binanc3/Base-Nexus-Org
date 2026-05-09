import { useState, useEffect, useCallback } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { MessageSquare, Send, Loader2, User, Clock, ExternalLink } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/src/supabase';
import { createLogData, appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';

export function BaseWall() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setMessages(data);
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !isConnected) return toast.error("Connect wallet");

    setIsPosting(true);
    const tId = toast.loading("Encrypting log...");

    try {
      const finalData = appendBuilderCode(createLogData(newMessage.trim()) as `0x${string}`);
      const hash = await sendTransactionAsync({ to: "0x000000000000000000000000000000000000dEaD", data: finalData, value: 0n });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      await supabase.from('messages').insert([{ content: newMessage.trim(), user_address: address, user_id: address, tx_hash: hash }]);
      setNewMessage('');
      toast.success("Log etched onchain!", { id: tId });
      fetchMessages();
    } catch (err: any) {
      toast.error(err.message?.includes('funds') ? "Need Base ETH gas." : "Failed.", { id: tId });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <GlassCard className="p-6 bg-[#050b14] border-[#00F0FF]/30 shadow-[0_0_30px_rgba(0,240,255,0.05)]">
        <form onSubmit={handlePost} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-[#00F0FF]" />
            <h2 className="text-xl font-black text-white tracking-widest uppercase">Global Ledger</h2>
          </div>
          <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Etch data onto the Base Network..." className="w-full bg-[#0a1224] border border-zinc-800 rounded-xl p-4 text-[#00F0FF] font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#00F0FF]/50 resize-none h-24" maxLength={280} />
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-zinc-600 font-mono">USER_ADDR: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "OFFLINE"}</p>
            <Button type="submit" disabled={isPosting || !newMessage.trim()} className="px-6 bg-[#00F0FF] text-black hover:bg-white font-bold">
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>TRANSMIT <Send className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
        </form>
      </GlassCard>

      <div className="space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
              <GlassCard className="p-4 border-zinc-800 bg-[#0a1224] hover:border-[#B026FF]/30 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-500 group-hover:text-[#B026FF]" />
                    <span className="text-xs font-mono text-zinc-400">{msg.user_address.slice(0, 6)}...{msg.user_address.slice(-4)}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-white text-sm font-medium">{msg.content}</p>
                {msg.tx_hash && (
                  <a href={`https://basescan.org/tx/${msg.tx_hash}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] text-[#00F0FF]/50 hover:text-[#00F0FF]">
                    BASE_SCAN_REF <ExternalLink className="w-3 h-3" />
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
