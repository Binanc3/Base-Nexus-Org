import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Trophy, Loader2, X } from 'lucide-react';
import { supabase } from '@/src/supabase';

// --- LEADERBOARD ---
export function Leaderboard({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data } = await supabase.from('leaderboards').select('*').eq('game_id', gameId).order('score', { ascending: false }).limit(10);
        setEntries(data || []);
      } catch (error) {} finally { setIsLoading(false); }
    };
    fetchLeaderboard();
  }, [gameId]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Top Players</h4>
      </div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/20 animate-spin" /></div> : entries.length === 0 ? <p className="text-xs text-white/40 text-center py-4 italic">No scores yet.</p> : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div key={idx} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <span className={`font-black text-sm ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-amber-600' : 'text-zinc-600'}`}>#{idx + 1}</span>
                <span className="text-xs font-mono text-zinc-300">{entry.user_address === 'Guest' ? 'Guest' : `${entry.user_address.slice(0,6)}...${entry.user_address.slice(-4)}`}</span>
              </div>
              <span className="text-sm font-bold text-white">{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const getMousePos = (canvas: HTMLCanvasElement, evt: any) => {
  const rect = canvas.getBoundingClientRect();
  let clientX = evt.clientX || 0; let clientY = evt.clientY || 0;
  if (evt.touches && evt.touches.length > 0) { clientX = evt.touches[0].clientX; clientY = evt.touches[0].clientY; } 
  else if (evt.changedTouches && evt.changedTouches.length > 0) { clientX = evt.changedTouches[0].clientX; clientY = evt.changedTouches[0].clientY; }
  return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
};

// ==========================================
// 1. BASE NINJA (Significantly Slower)
// ==========================================
export function SlicingGame({ onComplete, onExit }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    let animId: number; let fruits: any[] = []; let particles: any[] = []; let popups: any[] = []; let trail: {x: number, y: number}[] = [];
    let currentScore = 0; let lives = 3; let frame = 0; let difficultyTimer = 140; let speedMult = 0.6; // MUCH SLOWER
    let isDrawing = false; let activePerk = 'none'; let perkTimer = 0; let sliceCombo = 0;

    const spawnEntity = () => {
      speedMult = Math.min(1.2, 0.6 + (currentScore * 0.001)); // Slow acceleration
      const isPowerup = Math.random() < 0.08;
      const baseVy = -(Math.random() * 2 + 5.0) * speedMult; // Weak upward toss
      const baseVx = (Math.random() - 0.5) * 2.0;

      if (isPowerup) {
        const perkTypes = [{e:'❄️', c:'#00F0FF', p:'freeze'}, {e:'🔥', c:'#FF8C00', p:'frenzy'}, {e:'💚', c:'#00FF00', p:'heal'}];
        const t = perkTypes[Math.floor(Math.random() * perkTypes.length)];
        fruits.push({ x: Math.random() * (canvas.width-100)+50, y: canvas.height+50, vx: baseVx, vy: baseVy, emoji: t.e, color: t.c, type: 'perk', perk: t.p, size: 40, rot: 0, vRot: 0.05, sliced: false, sliceFrames: 0 });
      } else {
        const types = [{ e: '🍎', c: '#ef4444' }, { e: '🍊', c: '#f97316' }, { e: '🍉', c: '#22c55e' }, { e: '💣', c: '#1e293b', type: 'bomb' }];
        const t = types[Math.floor(Math.random() * types.length)];
        fruits.push({ x: Math.random() * (canvas.width-100)+50, y: canvas.height+50, vx: baseVx, vy: baseVy, emoji: t.e, color: t.c, type: t.type || 'fruit', size: t.type === 'bomb' ? 35 : 45, rot: 0, vRot: (Math.random()-0.5)*0.1, sliced: false, sliceFrames: 0 });
      }
    };

    const addPopup = (x: number, y: number, text: string, color: string) => { popups.push({ x, y, text, color, life: 1 }); };

    const loop = () => {
      if (!ctx || !canvas || !isPlaying || isGameOver) return;
      try {
        ctx.fillStyle = activePerk === 'freeze' ? 'rgba(0, 50, 100, 0.2)' : '#050b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        frame++;
        if (perkTimer > 0) { perkTimer--; if (perkTimer <= 0) activePerk = 'none'; }
        if (frame % Math.floor(difficultyTimer) === 0) {
          const spawnCount = Math.floor(Math.random() * 2) + 1;
          for(let s=0; s<spawnCount; s++) spawnEntity();
          if (difficultyTimer > 70) difficultyTimer -= 1; 
        }

        ctx.font = "24px Arial"; ctx.textAlign = 'right';
        let hearts = ""; for(let i=0; i<3; i++) hearts += i < lives ? "❤️ " : "🖤 ";
        ctx.fillText(hearts, canvas.width - 20, 40);
        if (activePerk !== 'none') { ctx.fillStyle = activePerk === 'freeze' ? '#00F0FF' : '#FF8C00'; ctx.textAlign = 'center'; ctx.font = "bold 20px Arial"; ctx.fillText(`${activePerk.toUpperCase()} ACTIVE!`, canvas.width/2, 40); }

        for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.y -= 2; p.life -= 0.02; ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.font = "bold 24px Arial"; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1; if (p.life <= 0) popups.splice(i, 1); }
        for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.02; ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; if (p.life <= 0) particles.splice(i, 1); }

        if (trail.length > 1) { ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y); for (let i=1; i<trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y); ctx.strokeStyle = activePerk === 'frenzy' ? '#FF8C00' : '#00F0FF'; ctx.lineWidth = activePerk === 'frenzy' ? 12 : 6; ctx.lineCap = 'round'; ctx.shadowBlur = 15; ctx.shadowColor = ctx.strokeStyle; ctx.stroke(); ctx.shadowBlur = 0; }

        for (let i = fruits.length - 1; i >= 0; i--) {
          const f = fruits[i]; const perkMod = activePerk === 'freeze' ? 0.3 : 1;
          f.x += f.vx * perkMod; f.y += f.vy * perkMod; f.vy += (0.06 * speedMult) * perkMod; f.rot += f.vRot; // Extremely low gravity 0.06

          if (f.sliced) {
            f.sliceFrames++; ctx.globalAlpha = Math.max(0, 1 - f.sliceFrames/20); ctx.font = `${f.size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.save(); ctx.translate(f.x - f.sliceFrames*2, f.y); ctx.rotate(f.rot - f.sliceFrames*0.1); ctx.fillText(f.emoji, 0, 0); ctx.restore(); ctx.save(); ctx.translate(f.x + f.sliceFrames*2, f.y); ctx.rotate(f.rot + f.sliceFrames*0.1); ctx.fillText(f.emoji, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
            if (f.sliceFrames > 20) fruits.splice(i, 1); continue;
          }

          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
          if (f.type === 'bomb') { ctx.shadowBlur = 20; ctx.shadowColor = '#FF003C'; }
          if (f.type === 'perk') { ctx.shadowBlur = 20; ctx.shadowColor = f.color; }
          ctx.font = `${f.size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.emoji, 0, 0); ctx.restore();

          if (f.y > canvas.height + 100) {
            if (f.type === 'fruit') { lives--; addPopup(canvas.width/2, canvas.height/2, "MISS!", "#FF003C"); if (lives <= 0) { setIsGameOver(true); return; } }
            fruits.splice(i, 1); continue;
          }

          if (trail.length > 0) {
            const last = trail[trail.length - 1]; const hitRadius = activePerk === 'frenzy' ? f.size + 30 : f.size + 15;
            if (Math.hypot(f.x - last.x, f.y - last.y) < hitRadius) {
              if (f.type === 'bomb') { lives--; addPopup(f.x, f.y, "BOOM!", "#FF003C"); sliceCombo = 0; for(let p=0; p<20; p++) particles.push({x: f.x, y: f.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, size: Math.random()*5+2, color: '#FF003C', life: 1}); if (lives <= 0) { setIsGameOver(true); return; } f.sliced = true; } 
              else if (f.type === 'perk') { if (f.perk === 'heal') { lives = Math.min(3, lives + 1); addPopup(f.x, f.y, "+1 LIFE", "#00FF00"); } else { activePerk = f.perk; perkTimer = 500; addPopup(f.x, f.y, "POWER UP!", f.color); } f.sliced = true; } 
              else { f.sliced = true; sliceCombo++; let pts = (activePerk === 'frenzy' ? 20 : 10); if (sliceCombo >= 3) { pts += sliceCombo * 5; addPopup(f.x, f.y, `${sliceCombo}x COMBO!`, "#FFD700"); } currentScore += pts; setScore(currentScore); for(let p=0; p<10; p++) particles.push({x: f.x, y: f.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, size: Math.random()*4+2, color: f.color, life: 1}); }
            }
          }
        }
        if (trail.length > 0 && !isDrawing) trail.shift(); if (trail.length > (activePerk === 'frenzy' ? 20 : 10)) trail.shift(); animId = requestAnimationFrame(loop);
      } catch(e) { console.error(e); setIsGameOver(true); }
    };

    const down = (e:any) => { isDrawing = true; sliceCombo = 0; trail.push(getMousePos(canvas, e)); };
    const move = (e:any) => { if(isDrawing) trail.push(getMousePos(canvas, e)); };
    const up = () => { isDrawing = false; trail = []; sliceCombo = 0; };
    canvas.addEventListener('mousedown', down); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down); canvas.addEventListener('touchmove', move); window.addEventListener('touchend', up);
    if (isPlaying) loop();
    return () => { cancelAnimationFrame(animId); canvas.removeEventListener('mousedown', down); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); canvas.removeEventListener('touchstart', down); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
  }, [isPlaying, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#00F0FF]/30 shadow-lg bg-[#050b14] h-[400px]">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-full touch-none cursor-crosshair" />
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-[#00F0FF] mb-2 uppercase tracking-widest">Base Ninja</h3>
            <p className="text-white/80 mb-6 text-sm">Balanced Speed. 3 Lives. Combo slices for power-ups!</p>
            <Button onClick={() => { setScore(0); setIsPlaying(true); setIsGameOver(false); }} className="px-12 py-4 bg-[#00F0FF] text-black hover:bg-white font-bold">PLAY NOW</Button>
            <Button variant="outline" onClick={onExit} className="mt-4 border-white/10">Back to Arcade</Button>
          </div>
        )}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-md">
            <h3 className="text-5xl font-black text-[#FF003C] mb-2">GAME OVER</h3>
            <div className="text-4xl font-black text-white mb-8">Score: {score}</div>
            <div className="flex gap-4">
              <Button onClick={() => onComplete(score)} className="bg-[#FF003C] text-white">Save Onchain</Button>
              <Button variant="outline" onClick={onExit}>Exit</Button>
            </div>
          </div>
        )}
        {isPlaying && !isGameOver && <div className="absolute top-4 left-4 text-3xl font-black text-white drop-shadow-md pointer-events-none">{score}</div>}
      </div>
      <Leaderboard gameId="FruitNinja" />
    </div>
  );
}

// ==========================================
// 2. BASE RUNNER (Custom Drawn Sci-Fi Obstacles)
// ==========================================
export function EndlessRunner({ onComplete, onExit }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    let animId: number; let player = { y: 0, vy: 0, isJumping: false };
    let obstacles: {x: number, w: number, h: number, type: 'spike'|'laser'|'box', passed: boolean}[] = [];
    let currentScore = 0; let speed = 7.0; let frame = 0; let bgX = 0;

    const jump = () => { if (!player.isJumping) { player.vy = 16.5; player.isJumping = true; } };

    const loop = () => {
      if (!ctx || !canvas || !isPlaying || isGameOver) return;
      try {
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height); bgX -= speed * 0.3;
        ctx.fillStyle = '#0f172a';
        for(let i=0; i<12; i++) {
          let x = (bgX + i * 120) % (canvas.width + 120); if (x < -120) x += canvas.width + 120;
          let bh = 100 + (i % 3) * 60; ctx.fillRect(x, canvas.height - bh - 40, 90, bh);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
          for(let r=0; r<4; r++) { for(let c=0; c<3; c++) { if (Math.random() > 0.3) ctx.fillRect(x + 10 + c*25, canvas.height - bh - 20 + r*20, 15, 10); } }
          ctx.fillStyle = '#0f172a';
        }
        ctx.fillStyle = '#050b14'; ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.shadowBlur = 15; ctx.shadowColor = '#B026FF'; ctx.fillStyle = '#B026FF'; ctx.fillRect(0, canvas.height - 42, canvas.width, 3); ctx.shadowBlur = 0;

        frame++;
        const spawnRate = Math.max(45, 85 - Math.floor(currentScore/20));
        if (frame % spawnRate === 0) {
          let type: 'spike'|'laser'|'box' = 'box'; let w = 40; let h = 40;
          if (currentScore > 100 && Math.random() < 0.3) { type = 'laser'; w = 15; h = 70; }
          if (currentScore > 200 && Math.random() < 0.3) { type = 'spike'; w = 50; h = 30; }
          obstacles.push({ x: canvas.width, w, h, type, passed: false });
        }

        player.y += player.vy; player.vy -= 0.85; if (player.y <= 0) { player.y = 0; player.vy = 0; player.isJumping = false; }
        const px = 100; const py = canvas.height - 40 - 35 - player.y;
        
        ctx.font = "35px Arial"; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.save(); ctx.translate(px, py); ctx.rotate(player.isJumping ? -0.2 : 0); ctx.fillText("🥷", 0, 0); ctx.restore();

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i]; o.x -= speed;
          let oy = canvas.height - 40 - o.h;
          
          if (o.type === 'box') {
            ctx.fillStyle = '#1e293b'; ctx.fillRect(o.x, oy, o.w, o.h);
            ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = '#00F0FF'; ctx.strokeRect(o.x, oy, o.w, o.h); ctx.shadowBlur = 0;
          } else if (o.type === 'laser') {
            ctx.fillStyle = '#FF003C'; ctx.shadowBlur = 20; ctx.shadowColor = '#FF003C'; ctx.fillRect(o.x, oy, o.w, o.h); ctx.shadowBlur = 0;
          } else if (o.type === 'spike') {
            ctx.fillStyle = '#FF8C00'; ctx.shadowBlur = 15; ctx.shadowColor = '#FF8C00';
            ctx.beginPath(); ctx.moveTo(o.x, oy + o.h); ctx.lineTo(o.x + o.w/2, oy); ctx.lineTo(o.x + o.w, oy + o.h); ctx.fill(); ctx.shadowBlur = 0;
          }

          if (px < o.x + o.w - 5 && px + 30 > o.x + 5 && py < oy + o.h - 5 && py + 35 > oy + 5) { setIsGameOver(true); return; }
          if (o.x < px && !o.passed) { o.passed = true; currentScore += 10; setScore(currentScore); speed += 0.05; }
          if (o.x < -100) obstacles.splice(i, 1);
        }

        animId = requestAnimationFrame(loop);
      } catch(e) { console.error(e); setIsGameOver(true); }
    };

    if (isPlaying) {
      const jumpHandler = (e:any) => { if(e.type !== 'keydown' || e.code === 'Space') jump(); };
      window.addEventListener('keydown', jumpHandler); canvas.addEventListener('touchstart', jumpHandler); canvas.addEventListener('mousedown', jumpHandler);
      loop();
      return () => { cancelAnimationFrame(animId); window.removeEventListener('keydown', jumpHandler); canvas.removeEventListener('touchstart', jumpHandler); canvas.removeEventListener('mousedown', jumpHandler); };
    }
  }, [isPlaying, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#B026FF]/30 shadow-lg bg-[#050b14] h-[400px]">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-full touch-none" />
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-[#B026FF] mb-2 uppercase tracking-widest">Base Runner</h3>
            <p className="text-white/60 mb-6 text-sm">Evade Neon Blocks, Spikes, and Lasers.</p>
            <Button onClick={() => { setScore(0); setIsPlaying(true); setIsGameOver(false); }} className="px-12 py-4 bg-[#B026FF] text-white font-bold">INITIALIZE</Button>
            <Button variant="outline" onClick={onExit} className="mt-4 border-white/10">Back</Button>
          </div>
        )}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-md">
            <h3 className="text-5xl font-black text-[#FF003C] mb-2">CRASHED</h3>
            <div className="text-4xl font-black text-white mb-8">Score: {score}</div>
            <div className="flex gap-4">
              <Button onClick={() => onComplete(score)} className="bg-[#B026FF] text-white">Save Onchain</Button>
              <Button variant="outline" onClick={onExit}>Exit</Button>
            </div>
          </div>
        )}
        {isPlaying && !isGameOver && <div className="absolute top-4 left-4 text-3xl font-black text-white pointer-events-none">{score}</div>}
      </div>
      <Leaderboard gameId="EndlessRunner" />
    </div>
  );
}

// ==========================================
// 3. NEON DEFENDER (Custom Ships, Bosses take 2 hits, Life Subtracted on Miss)
// ==========================================
export function NeonDefender({ onComplete, onExit }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    let animId: number; let playerX = canvas.width / 2; let lives = 3; let invulnTimer = 0;
    let activeShield = 0; let activeRapid = 0; let activeSpread = 0;
    let bullets: {x: number, y: number, dx: number, dy: number}[] = [];
    let enemyBullets: {x: number, y: number}[] = [];
    let enemies: {x: number, y: number, r: number, type: 'grunt'|'boss', hp: number, rot: number}[] = [];
    let powerups: {x: number, y: number, type: 'shield'|'rapid'|'spread', color: string}[] = [];
    let currentScore = 0; let frame = 0; let lastFire = 0;

    const loop = () => {
      if (!ctx || !canvas || !isPlaying || isGameOver) return;
      try {
        ctx.fillStyle = 'rgba(5, 11, 20, 0.4)'; ctx.fillRect(0, 0, canvas.width, canvas.height); frame++;
        if (invulnTimer > 0) invulnTimer--; if (activeShield > 0) activeShield--; if (activeRapid > 0) activeRapid--; if (activeSpread > 0) activeSpread--;

        ctx.font = "24px Arial"; ctx.textAlign = 'right';
        let hearts = ""; for(let i=0; i<3; i++) hearts += i < lives ? "❤️ " : "🖤 ";
        ctx.fillText(hearts, canvas.width - 20, 40);
        
        let perkText = "";
        if (activeShield > 0) perkText += "SHIELD "; if (activeRapid > 0) perkText += "RAPID "; if (activeSpread > 0) perkText += "SPREAD ";
        if (perkText !== "") { ctx.fillStyle = '#00F0FF'; ctx.textAlign = 'center'; ctx.font = "bold 16px Arial"; ctx.fillText(perkText + "ACTIVE", canvas.width/2, 40); }

        let spawnRate = Math.max(35, 80 - Math.floor(currentScore / 20));
        if (frame % spawnRate === 0) {
          const isBoss = currentScore > 100 && Math.random() < 0.3;
          enemies.push({ x: Math.random()*(canvas.width-60)+30, y: -30, r: isBoss ? 30 : 20, type: isBoss ? 'boss' : 'grunt', hp: isBoss ? 2 : 1, rot: 0 });
        }

        const fireRate = activeRapid > 0 ? 6 : 14;
        if (frame - lastFire > fireRate) {
          bullets.push({ x: playerX, y: canvas.height - 50, dx: 0, dy: -15 });
          if (activeSpread > 0) { bullets.push({ x: playerX, y: canvas.height - 50, dx: -3, dy: -14 }); bullets.push({ x: playerX, y: canvas.height - 50, dx: 3, dy: -14 }); }
          lastFire = frame;
        }

        if (invulnTimer === 0 || Math.floor(frame / 5) % 2 === 0) {
          ctx.save(); ctx.translate(playerX, canvas.height - 40);
          if (activeShield > 0) { ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2; ctx.stroke(); }
          ctx.fillStyle = '#00F0FF'; ctx.shadowBlur = 15; ctx.shadowColor = '#00F0FF';
          ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-15, 15); ctx.lineTo(0, 5); ctx.lineTo(15, 15); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
          ctx.fillStyle = '#FF003C'; ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(0, 20 + Math.random()*10); ctx.lineTo(5, 8); ctx.fill();
          ctx.restore();
        }

        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i]; p.y += 3;
          ctx.fillStyle = p.color; ctx.shadowBlur = 15; ctx.shadowColor = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
          if (Math.hypot(p.x - playerX, p.y - (canvas.height - 40)) < 25) {
            if (p.type === 'shield') activeShield = 600; if (p.type === 'rapid') activeRapid = 450; if (p.type === 'spread') activeSpread = 450;
            powerups.splice(i, 1); continue;
          }
          if (p.y > canvas.height) powerups.splice(i, 1);
        }

        ctx.fillStyle = '#FFF'; ctx.shadowBlur = 10; ctx.shadowColor = '#FFF';
        for (let i = bullets.length - 1; i >= 0; i--) { const b = bullets[i]; b.x += b.dx; b.y += b.dy; ctx.fillRect(b.x - 2, b.y, 4, 15); if (b.y < 0 || b.x < 0 || b.x > canvas.width) bullets.splice(i, 1); } ctx.shadowBlur = 0;

        ctx.fillStyle = '#FF003C'; ctx.shadowBlur = 10; ctx.shadowColor = '#FF003C';
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const b = enemyBullets[i]; b.y += 7; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
          if (activeShield <= 0 && invulnTimer <= 0 && Math.hypot(b.x - playerX, b.y - (canvas.height - 40)) < 15) { lives--; invulnTimer = 60; enemyBullets.splice(i, 1); if (lives <= 0) { setIsGameOver(true); return; } continue; }
          if (b.y > canvas.height) enemyBullets.splice(i, 1);
        } ctx.shadowBlur = 0;

        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          
          if (e.type === 'boss') {
            e.y += 1.0 + (currentScore * 0.002); e.x += (playerX > e.x ? 1 : -1) * 0.8; 
            if (Math.random() < 0.02) enemyBullets.push({ x: e.x, y: e.y + 15 });
            // Draw Boss Ship
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.PI); // Facing down
            ctx.fillStyle = e.hp === 2 ? '#B026FF' : '#FF003C'; // Changes color when hit
            ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
            ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(-e.r, e.r); ctx.lineTo(0, e.r - 10); ctx.lineTo(e.r, e.r); ctx.closePath(); ctx.fill(); ctx.restore();
          } else {
            e.y += 2.0 + (currentScore * 0.003); e.rot += 0.05;
            // Draw Grunt Ship
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
            ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 3; ctx.shadowBlur = 15; ctx.shadowColor = '#00F0FF';
            ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(-e.r/2, e.r); ctx.lineTo(e.r/2, e.r); ctx.closePath(); ctx.stroke(); ctx.restore();
          }

          let hit = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            if (Math.hypot(bullets[j].x - e.x, bullets[j].y - e.y) < e.r + 5) {
              bullets.splice(j, 1); e.hp--;
              if (e.hp <= 0) {
                enemies.splice(i, 1); currentScore += (e.type === 'boss' ? 30 : 10); setScore(currentScore);
                if (Math.random() < 0.12) {
                  const pTypes = [{t:'shield',c:'#00F0FF'}, {t:'rapid',c:'#FFD700'}, {t:'spread',c:'#FF00FF'}];
                  const pick = pTypes[Math.floor(Math.random()*pTypes.length)];
                  powerups.push({ x: e.x, y: e.y, type: pick.t as any, color: pick.c });
                }
              }
              hit = true; break;
            }
          }
          if (hit) continue;

          if (activeShield <= 0 && invulnTimer <= 0 && Math.hypot(playerX - e.x, (canvas.height - 40) - e.y) < e.r + 15) {
            lives--; invulnTimer = 60; enemies.splice(i, 1); if (lives <= 0) { setIsGameOver(true); return; }
          } else if (e.y > canvas.height + 50) {
            // FIX: Subtract life when enemy is missed
            lives--; invulnTimer = 30; enemies.splice(i, 1); if (lives <= 0) { setIsGameOver(true); return; }
          }
        }
        animId = requestAnimationFrame(loop);
      } catch(e) { console.error(e); setIsGameOver(true); }
    };

    const handleMove = (e: any) => { if(isPlaying) playerX = getMousePos(canvas, e).x; };
    canvas.addEventListener('mousemove', handleMove); canvas.addEventListener('touchmove', handleMove, { passive: true });
    if (isPlaying) loop();
    return () => { cancelAnimationFrame(animId); canvas.removeEventListener('mousemove', handleMove); canvas.removeEventListener('touchmove', handleMove); };
  }, [isPlaying, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#00F0FF]/50 shadow-lg bg-[#050b14] h-[500px]">
        <canvas ref={canvasRef} width={600} height={500} className="w-full h-full touch-none cursor-crosshair" />
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-white mb-2 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,240,255,1)]">Neon Defender</h3>
            <p className="text-white/80 mb-6 text-sm text-center px-4">Bosses take 2 hits and fire back.<br/><span className="text-[#FF003C] font-bold">Missing enemies costs a life!</span></p>
            <Button onClick={() => { setScore(0); setIsPlaying(true); setIsGameOver(false); }} className="px-12 py-4 bg-transparent border-2 border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black font-bold">SCRAMBLE SHIP</Button>
            <Button variant="outline" onClick={onExit} className="mt-4 border-white/10">Back</Button>
          </div>
        )}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-md">
            <h3 className="text-5xl font-black text-[#FF003C] mb-2">HULL DESTROYED</h3>
            <div className="text-4xl font-black text-white mb-8">Score: {score}</div>
            <div className="flex gap-4">
              <Button onClick={() => onComplete(score)} className="bg-[#00F0FF] text-black hover:bg-white">Save Onchain</Button>
              <Button variant="outline" onClick={onExit}>Exit</Button>
            </div>
          </div>
        )}
        {isPlaying && !isGameOver && <div className="absolute top-4 left-4 text-3xl font-black text-white pointer-events-none">{score}</div>}
      </div>
      <Leaderboard gameId="NeonDefender" />
    </div>
  );
}
