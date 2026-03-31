import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Bot, Send, Database, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '@/src/lib/utils';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { stringToHex } from 'viem';
import { BASE_BUILDER_CODE } from '../../lib/wagmi';
import { toast } from 'sonner';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export function OnchainAI() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOnchain, setIsLoggingOnchain] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMsg,
      });
      
      setMessages(prev => [...prev, { role: 'ai', content: response.text || 'No response' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: 'Error generating response.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const logSessionOnchain = async () => {
    if (!address || messages.length === 0 || isLoggingOnchain) return;

    setIsLoggingOnchain(true);
    try {
      // Create a summary of the session
      const summary = `AI_SESSION:${messages.length}_MSGS:${messages[messages.length-1].content.substring(0, 20)}...`;
      const summaryHex = stringToHex(summary);

      toast.loading("Logging AI session onchain...", { id: 'ai-log' });

      // We send to the user's own address with the data appended for self-logging
      // This is a reliable way to log data onchain with builder attribution
      const hash = await sendTransactionAsync({
        to: address,
        value: 0n,
        data: `${stringToHex(summary).replace('0x', '')}${BASE_BUILDER_CODE.replace('0x', '')}` as `0x${string}`,
      });

      toast.loading("Waiting for confirmation...", { id: 'ai-log' });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      toast.success("AI Session Logged!", { 
        id: 'ai-log',
        description: "Your interaction summary is now onchain."
      });
    } catch (error) {
      console.error(error);
      toast.error("Logging Failed", { 
        id: 'ai-log',
        description: error instanceof Error ? error.message : "Failed to log session."
      });
    } finally {
      setIsLoggingOnchain(false);
    }
  };

  return (
    <GlassCard className="flex flex-col h-[600px] max-w-2xl mx-auto">
      <div className="p-4 border-bottom border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Base AI Oracle</h3>
            <p className="text-xs text-white/40">Onchain logging enabled</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="text-xs flex items-center gap-2"
          onClick={logSessionOnchain}
          disabled={isLoggingOnchain || messages.length === 0}
        >
          {isLoggingOnchain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Log Session Onchain
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Sparkles className="w-12 h-12 text-blue-400/20 mb-4" />
            <p className="text-white/60">Start a conversation with the Base AI. Your interaction summaries can be permanently stored on the Base network.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "max-w-[80%] p-3 rounded-2xl",
            msg.role === 'user' ? "bg-blue-600 ml-auto text-white" : "bg-white/10 text-white"
          )}>
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="text-white/40 text-sm animate-pulse">AI is thinking...</div>}
      </div>

      <div className="p-4 border-t border-white/10 flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything about Base..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500/50"
        />
        <Button onClick={handleSend} disabled={isLoading}>
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </GlassCard>
  );
}
