import { useState } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Bot, Send, Loader2 } from 'lucide-react';

export function OnchainAI() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");

      // FIX: Standard fetch bypasses the SDK CORS restrictions in Vite
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMsg }] }]
        })
      });

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

      setMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Ensure your VITE_GEMINI_API_KEY is valid.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-8 h-8 text-blue-400" />
        <h2 className="text-3xl font-bold text-white">Nexus AI Oracle</h2>
      </div>

      <GlassCard className="h-[500px] flex flex-col p-4">
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.length === 0 && (
            <div className="text-center text-white/40 mt-20">Ask the Oracle anything about Base, DeFi, or smart contracts...</div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600/20 text-blue-100 ml-auto' : 'bg-white/5 text-white mr-auto'}`}>
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="bg-white/5 text-white/50 p-4 rounded-2xl max-w-[80%] mr-auto flex gap-2 items-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50"
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="px-6">
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
