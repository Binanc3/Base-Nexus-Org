import { useState, useRef, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Bot, Send, Database, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '@/src/lib/utils';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { stringToHex } from 'viem';
import { ONCHAIN_LOG_ADDRESS, appendBuilderCode } from '../../lib/wagmi';
import { toast } from 'sonner';

// ✅ FIX 1: Vite uses import.meta.env, not process.env
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export function OnchainAI() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOnchain, setIsLoggingOnchain] = useState(false);

  // ✅ FIX 2: Auto-scroll to latest message
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // ✅ FIX 3: Correct Gemini model name
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: userMsg,
      });

      setMessages(prev => [...prev, { role: 'ai', content: response.text || 'No response' }]);
    } catch (error) {
      console.error('[AI Error]', error);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'Error generating response. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const logSessionOnchain = async () => {
    if (!address || messages.length === 0 || isLoggingOnchain) return;

    setIsLoggingOnchain(true);
    try {
      const lastMsg = messages[messages.length - 1].content.substring(0, 50);
      const summary = `AI_SESSION:${messages.length}_MSGS:${lastMsg}...`;

      // ✅ FIX 4: Removed unused `summaryHex` variable that was declared but never used
      const logData = appendBuilderCode(stringToHex(summary));

      toast.loading('Logging AI session onchain…', { id: 'ai-log' });

      const hash = await sendTransactionAsync({
        to: ONCHAIN_LOG_ADDRESS,
        value: 0n,
        data: logData,
      });

      toast.loading('Waiting for confirmation…', { id: 'ai-log' });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 60_000,
          pollingInterval: 3_000,
        });

        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted onchain');
        }
      }

      toast.success('AI Session Logged!', {
        id: 'ai-log',
        description: 'Your interaction summary is now permanently onchain.',
      });

    } catch (error) {
      console.error('[OnchainLog Error]', error);

      let description = 'Failed to log session.';
      if (error instanceof Error) {
        if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
          description = 'You rejected the transaction in your wallet.';
        } else if (error.message.includes('insufficient funds')) {
          description = 'Not enough ETH for gas fees.';
        } else {
          description = error.message.substring(0, 80);
        }
      }

      toast.error('Logging Failed', { id: 'ai-log', description });
    } finally {
      setIsLoggingOnchain(false);
    }
  };

  return (
    <GlassCard className="flex flex-col h-[600px] max-w-2xl mx-auto">

      {/* ✅ FIX 5: `border-bottom` is not valid Tailwind — fixed to `border-b` */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
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
          disabled={isLoggingOnchain || messages.length === 0 || !address}
        >
          {isLoggingOnchain
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Database className="w-4 h-4" />
          }
          Log Session Onchain
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Sparkles className="w-12 h-12 text-blue-400/20 mb-4" />
            <p className="text-white/60">
              Start a conversation with the Base AI. Your interaction summaries
              can be permanently stored on the Base network.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-blue-600 ml-auto text-white'
                : 'bg-white/10 text-white'
            )}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="text-white/40 text-sm animate-pulse flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI is thinking…
          </div>
        )}
        {/* ✅ FIX 6: Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-white/10 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask anything about Base…"
          disabled={isLoading}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500/50 disabled:opacity-50"
        />
        <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
          {isLoading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Send className="w-5 h-5" />
          }
        </Button>
      </div>

    </GlassCard>
  );
}
