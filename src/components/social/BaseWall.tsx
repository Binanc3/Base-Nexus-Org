import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { MessageSquare, Send, Loader2, User, Clock, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAccount, useSendTransaction } from 'wagmi';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/src/supabase';
import { stringToHex } from 'viem';
import { BASE_BUILDER_CODE } from '../../lib/wagmi';
import { cn } from '@/src/lib/utils';

interface Message {
  id: string;
  content: string;
  user_address: string;
  user_id: string;
  created_at: string;
  tx_hash?: string;
}

export function BaseWall() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (supabaseError) throw supabaseError;
      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel('wall_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        fetchMessages();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Real-time subscription error');
          setError("Real-time updates may be unavailable.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !newMessage.trim() || isPosting) return;

    setIsPosting(true);
    try {
      // 1. Onchain Logging - MANDATORY for wall posts now
      const messageData = stringToHex(`MSG:${newMessage.trim().substring(0, 20)}`);
      const txHash = await sendTransactionAsync({
        to: address,
        value: 0n,
        data: `${messageData}${BASE_BUILDER_CODE.replace('0x', '')}` as `0x${string}`,
      });

      if (!txHash) throw new Error("Transaction failed or was rejected");

      // 2. Save to Supabase ONLY if tx was successful
      const { error: supabaseError } = await supabase
        .from('messages')
        .insert([
          {
            content: newMessage.trim(),
            user_address: address,
            tx_hash: txHash
          }
        ]);

      if (supabaseError) throw supabaseError;

      setNewMessage('');
    } catch (error) {
      console.error("Error posting message:", error);
      setError(error instanceof Error ? error.message : "Failed to post message. Ensure transaction is confirmed.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <GlassCard className="p-6 border-blue-500/20 bg-blue-600/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">The Base Wall</h2>
            <p className="text-xs text-white/40">Leave your mark on the Base ecosystem. Messages are stored onchain & offchain.</p>
          </div>
        </div>

        <form onSubmit={handlePost} className="space-y-4 relative">
          {!address && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl border border-white/5">
              <div className="text-center p-6">
                <ShieldCheck className="w-8 h-8 text-blue-400 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-white font-medium mb-4">Connect your wallet to leave a message on the wall.</p>
                <p className="text-xs text-white/40 italic">Your message will be stored onchain & offchain.</p>
              </div>
            </div>
          )}
          <div className="relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="What's on your mind? (Max 280 characters)"
              maxLength={280}
              disabled={!address}
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 transition-all resize-none h-32 disabled:opacity-50"
            />
            <div className="absolute bottom-4 right-4 text-[10px] text-white/20 font-mono">
              {newMessage.length}/280
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest font-bold">
              <ShieldCheck className="w-3 h-3 text-green-400" />
              Verified Onchain
            </div>
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || isPosting || !address}
              className="px-8 py-3 gap-2"
            >
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Post to Wall
            </Button>
          </div>
        </form>
      </GlassCard>

      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center italic">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-white/20 italic">Loading the wall...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
            <p className="text-white/20 italic">The wall is empty. Be the first to shout!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard className="p-5 hover:border-white/20 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center shrink-0 border border-white/5">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate max-w-[120px]">
                              {msg.user_address === 'Guest' ? 'Guest Explorer' : `${msg.user_address.substring(0, 6)}...${msg.user_address.substring(38)}`}
                            </span>
                            {msg.user_address === address && address && (
                              <span className="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 text-[8px] font-bold rounded uppercase tracking-tighter">You</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-white/20">
                            <Clock className="w-3 h-3" />
                            {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : 'Just now'}
                          </div>
                        </div>
                      <p className="text-sm text-white/80 leading-relaxed break-words">
                        {msg.content}
                      </p>
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div className="flex gap-3">
                          {msg.user_address !== 'Guest' && (
                            <button 
                              onClick={() => window.open(`https://basescan.org/${msg.tx_hash ? 'tx/' + msg.tx_hash : 'address/' + msg.user_address}`, '_blank')}
                              className="text-[10px] text-white/20 hover:text-blue-400 transition-colors flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {msg.tx_hash ? 'View Transaction' : 'View Profile'}
                            </button>
                          )}
                        </div>
                        <div className="text-[9px] text-white/10 font-mono">
                          ID: {String(msg.id).substring(0, 8)}
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
