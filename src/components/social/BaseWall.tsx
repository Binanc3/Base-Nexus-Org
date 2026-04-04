import { useState, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { MessageSquare, Send, Loader2, User, Clock, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/src/supabase';
import { createLogData } from '../../lib/wagmi';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  user_address: string;
  user_id: string;
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
    if (!address || !newMessage.trim() || isPosting || !isConnected) {
      if (!isConnected) {
        toast.error("Wallet not connected", { description: "Please connect your wallet to post." });
      }
      return;
    }

    setIsPosting(true);
    try {
      // 1. Create transaction data with builder code
      const txData = createLogData(newMessage.trim());
      console.log('[BaseWall] Posting with data:', txData);
      
      toast.loading("Posting to Base Wall...", { id: 'wall-post' });
      
      // 2. Send transaction to self for data logging
      const txHash = await sendTransactionAsync({
        to: address, // Send to self
        value: 0n,
        data: txData,
        gas: 21000n + 4n * BigInt(txData.length / 2), // Proper gas calculation
      });
