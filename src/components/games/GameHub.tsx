import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Trophy, Loader2, Rocket, Zap, Crosshair } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/src/supabase';

export function Leaderboard({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase.from('leaderboards').select('*').eq('game_id', gameId).order('score', { ascending: false }).limit(10);
        if (error) throw error;
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

// Helper to get correct canvas coordinates for any screen size
const getMousePos = (canvas: HTMLCanvasElement, evt: any) => {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
};

// ==========================================
// 1. BASE NINJA (Fruits Restored + Particles)
// ==========================================
export function SlicingGame({ onComplete, onExit }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let animId: number;
    let fruits: any[] = [];
    let particles: any[] = [];
    let trail: {x: number, y: number}[] = [];
    let currentScore = 0;
    let frame = 0;
    let difficultyTimer = 100;
    let isDrawing = false;

    const spawnFruit = () => {
      const types = [
        { e: '🍎', c: '#ef4444' }, { e: '🍊', c: '#f97316' }, 
        { e: '🍉', c: '#22c55e' }, { e: '🍍', c: '#eab308' },
        { e: '💣', c: '#1e293b', bomb: true }
      ];
      const t = types[Math.floor(Math.random() * types.length)];
      fruits.push({
        x: Math.random() * (canvas.width - 100) + 50,
        y: canvas.height + 50,
        vx: (Math.random() - 0.5) * 4,
        vy: -(Math.random() * 4 + 10),
        emoji: t.e, color: t.c, isBomb: t.bomb,
        size: t.bomb ? 35 : 45,
        rot: 0, vRot: (Math.random() - 0.5) * 0.2,
        sliced: false, sliceFrames: 0
      });
    };

    const loop = () => {
      if (!isPlaying || isGameOver) return;
      ctx.fillStyle = '#050b14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      frame++;

      if (frame % difficultyTimer === 0) {
        spawnFruit();
        if (difficultyTimer > 30) difficultyTimer -= 2; // Progressive difficulty
      }

      // Render Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.02;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Render Trail
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i=1; i<trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.shadowBlur = 15; ctx.shadowColor = '#00F0FF';
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      // Render Fruits
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.x += f.vx; f.y += f.vy; f.vy += 0.15; f.rot += f.vRot;

        if (f.sliced) {
          f.sliceFrames++;
          ctx.save(); ctx.translate(f.x - f.sliceFrames*2, f.y); ctx.rotate(f.rot - f.sliceFrames*0.1);
          ctx.font = `${f.size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(f.emoji, 0, 0); ctx.restore();
          
          ctx.save(); ctx.translate(f.x + f.sliceFrames*2, f.y); ctx.rotate(f.rot + f.sliceFrames*0.1);
          ctx.font = `${f.size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.globalAlpha = 0.5; ctx.fillText(f.emoji, 0, 0); ctx.globalAlpha = 1; ctx.restore();
          
          if (f.sliceFrames > 20) fruits.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        if (f.isBomb) { ctx.shadowBlur = 20; ctx.shadowColor = '#FF003C'; }
        ctx.font = `${f.size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();

        // Slice Detection
        if (trail.length > 0) {
          const last = trail[trail.length - 1];
          if (Math.hypot(f.x - last.x, f.y - last.y) < f.size) {
            if (f.isBomb) { setIsGameOver(true); return; }
            f.sliced = true;
            currentScore += 10; setScore(currentScore);
            // Explode particles
            for(let p=0; p<10; p++) particles.push({x: f.x, y: f.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, size: Math.random()*4+2, color: f.color, life: 1});
          }
        }
        if (f.y > canvas.height + 100) fruits.splice(i, 1);
      }
      
      if (trail.length > 0 && !isDrawing) trail.shift();
      if (trail.length > 10) trail.shift(); // Trail length
      
      animId = requestAnimationFrame(loop);
    };

    const down = (e:any) => { isDrawing = true; trail.push(getMousePos(canvas, e)); };
    const move = (e:any) => { if(isDrawing) trail.push(getMousePos(canvas, e)); };
    const up = () => { isDrawing = false; trail = []; };

    canvas.addEventListener('mousedown', down); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down); canvas.addEventListener('touchmove', move); window.addEventListener('touchend', up);

    if (isPlaying) loop();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', down); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      canvas.removeEventListener('touchstart', down); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', up);
    };
  }, [isPlaying, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#00F0FF]/30 shadow-lg bg-[#050b14] h-[400px]">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-full touch-none" />
        
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-[#00F0FF] mb-2 uppercase tracking-widest">Base Ninja</h3>
            <p className="text-white/60 mb-6">Slice fruits. Avoid bombs.</p>
            <Button onClick={() => setIsPlaying(true)} className="px-12 py-4 bg-[#00F0FF] text-black">PLAY NOW</Button>
            <Button variant="outline" onClick={onExit} className="mt-4 border-white/10">Back to Arcade</Button>
          </div>
        )}

        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-md">
            <h3 className="text-5xl font-black text-[#FF003C] mb-2">WASTED</h3>
            <div className="text-4xl font-black text-white mb-8">{score}</div>
            <div className="flex gap-4">
              <Button onClick={() => onComplete(score)} className="bg-[#FF003C] text-white">Save Score Onchain</Button>
              <Button variant="outline" onClick={onExit}>Exit</Button>
            </div>
          </div>
        )}

        {isPlaying && !isGameOver && (
          <div className="absolute top-4 left-4 text-3xl font-black text-white drop-shadow-md pointer-events-none">{score}</div>
        )}
      </div>
      <Leaderboard gameId="FruitNinja" />
    </div>
  );
}

// ==========================================
// 2. BASE RUNNER (Restored & Cyberpunked)
// ==========================================
export function EndlessRunner({ onComplete, onExit }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let animId: number;
    let player = { y: 0, vy: 0, isJumping: false };
    let obstacles: {x: number, w: number, h: number, passed: boolean}[] = [];
    let currentScore = 0;
    let speed = 6;
    let frame = 0;
    let bgX = 0;

    const jump = () => { if (!player.isJumping) { player.vy = 15; player.isJumping = true; } };

    const loop = () => {
      if (!isPlaying || isGameOver) return;
      
      // Cyber City Background
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      bgX -= speed * 0.2;
      ctx.fillStyle = '#0f172a';
      for(let i=0; i<10; i++) {
        let x = (bgX + i * 150) % (canvas.width + 150);
        if (x < -150) x += canvas.width + 150;
        ctx.fillRect(x, canvas.height - 150, 80, 150);
      }
      
      // Neon Floor
      ctx.fillStyle = '#050b14'; ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
      ctx.shadowBlur = 15; ctx.shadowColor = '#B026FF'; ctx.fillStyle = '#B026FF';
      ctx.fillRect(0, canvas.height - 42, canvas.width, 3); ctx.shadowBlur = 0;

      frame++;
      if (frame % Math.max(40, 100 - Math.floor(currentScore/10)) === 0) {
        obstacles.push({ x: canvas.width, w: 20, h: Math.random() > 0.5 ? 40 : 60, passed: false });
      }

      // Player Physics
      player.y += player.vy; player.vy -= 0.8; // gravity
      if (player.y <= 0) { player.y = 0; player.vy = 0; player.isJumping = false; }

      const px = 100;
      const py = canvas.height - 40 - 30 - player.y;
      
      // Draw Player (Glowing Runner)
      ctx.fillStyle = '#00F0FF'; ctx.shadowBlur = 20; ctx.shadowColor = '#00F0FF';
      ctx.fillRect(px, py, 30, 30); ctx.shadowBlur = 0;

      // Obstacles & Collision
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed;
        
        ctx.fillStyle = '#FF003C'; ctx.shadowBlur = 15; ctx.shadowColor = '#FF003C';
        ctx.fillRect(o.x, canvas.height - 40 - o.h, o.w, o.h); ctx.shadowBlur = 0;

        // Collision box
        if (px < o.x + o.w && px + 30 > o.x && py < canvas.height - 40 && py + 30 > canvas.height - 40 - o.h) {
          setIsGameOver(true); return;
        }

        if (o.x < px && !o.passed) { o.passed = true; currentScore += 10; setScore(currentScore); speed += 0.1; }
        if (o.x < -50) obstacles.splice(i, 1);
      }

      animId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      window.addEventListener('keydown', (e) => { if(e.code==='Space') jump(); });
      canvas.addEventListener('touchstart', jump);
      canvas.addEventListener('mousedown', jump);
      loop();
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', jump);
      canvas.removeEventListener('touchstart', jump);
      canvas.removeEventListener('mousedown', jump);
    };
  }, [isPlaying, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#B026FF]/30 shadow-lg bg-[#050b14] h-[400px]">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-full touch-none" />
        
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-[#B026FF] mb-2 uppercase tracking-widest">Base Runner</h3>
            <p className="text-white/60 mb-6">Tap to Jump. Survive the grid.</p>
            <Button onClick={() => setIsPlaying(true)} className="px-12 py-4 bg-[#B026FF] text-white">INITIALIZE</Button>
            <Button variant="outline" onClick={onExit} className="mt-4 border-white/10">Back to Arcade</Button>
          </div>
        )}

        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-md">
            <h3 className="text-5xl font-black text-[#FF003C] mb-2">SYSTEM FAILURE</h3>
            <div className="text-4xl font-black text-white mb-8">{score}</div>
            <div className="flex gap-4">
              <Button onClick={() => onComplete(score)} className="bg-[#B026FF] text-white">Save Score Onchain</Button>
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
// 3. NEON DEFENDER (Overhauled Dynamics)
// ==========================================
export function NeonDefender({ onComplete, onExit }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let animId: number;
    let playerX = canvas.width / 2;
    let bullets: {x: number, y: number}[] = [];
    let enemies: {x: number, y: number, r: number, rot: number, hp: number}[] = [];
    let currentScore = 0;
    let frame = 0;
    
    // Auto-fire timer
    let lastFire = 0;

    const loop = () => {
      if (!isPlaying || isGameOver) return;
      ctx.fillStyle = 'rgba(5, 11, 20, 0.4)'; // Smooth trailing effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      frame++;

      // Difficulty Scaling: Base spawn is every 80 frames. Gets faster as score increases.
      let spawnRate = Math.max(20, 80 - Math.floor(currentScore / 20));
      if (frame % spawnRate === 0) {
        enemies.push({ x: Math.random()*(canvas.width-40)+20, y: -30, r: Math.random()*10 + 15, rot: 0, hp: 1 });
      }

      // Auto-Fire Mechanics
      if (frame - lastFire > 10) {
        bullets.push({ x: playerX, y: canvas.height - 50 });
        lastFire = frame;
      }

      // Draw Player Ship (Delta Wing)
      ctx.save(); ctx.translate(playerX, canvas.height - 40);
      ctx.fillStyle = '#00F0FF'; ctx.shadowBlur = 15; ctx.shadowColor = '#00F0FF';
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-15, 15); ctx.lineTo(0, 5); ctx.lineTo(15, 15); ctx.closePath();
      ctx.fill(); ctx.shadowBlur = 0;
      // Thruster
      ctx.fillStyle = '#FF003C'; ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(0, 20 + Math.random()*10); ctx.lineTo(5, 8); ctx.fill();
      ctx.restore();

      // Bullets
      ctx.fillStyle = '#FFF'; ctx.shadowBlur = 10; ctx.shadowColor = '#FFF';
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y -= 15; ctx.fillRect(b.x - 2, b.y, 4, 15);
        if (b.y < 0) bullets.splice(i, 1);
      }
      ctx.shadowBlur = 0;

      // Enemies
      ctx.strokeStyle = '#B026FF'; ctx.lineWidth = 2;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        // Enemy speed scales slightly with score
        e.y += 2 + (currentScore * 0.005); 
        e.rot += 0.05;

        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
        ctx.shadowBlur = 15; ctx.shadowColor = '#B026FF';
        ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0); ctx.closePath(); ctx.stroke();
        ctx.restore();

        // Bullet Collision
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 5) {
            enemies.splice(i, 1); bullets.splice(j, 1);
            currentScore += 10; setScore(currentScore);
            break;
          }
        }

        // Ship Collision
        if (Math.hypot(playerX - e.x, (canvas.height - 40) - e.y) < e.r + 15) {
          setIsGameOver(true); return;
        }
        if (e.y > canvas.height + 50) enemies.splice(i, 1);
      }

      animId = requestAnimationFrame(loop);
    };

    const handleMove = (e: any) => { if(isPlaying) playerX = getMousePos(canvas, e).x; };
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('touchmove', handleMove);

    if (isPlaying) loop();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('touchmove', handleMove);
    };
  }, [isPlaying, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#00F0FF]/50 shadow-lg bg-[#050b14] h-[500px]">
        <canvas ref={canvasRef} width={600} height={500} className="w-full h-full touch-none cursor-crosshair" />
        
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-white mb-2 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,240,255,1)]">Neon Defender</h3>
            <p className="text-white/80 mb-6 text-sm">Drag to Move. Auto-Fire Engaged.</p>
            <Button onClick={() => setIsPlaying(true)} className="px-12 py-4 bg-transparent border-2 border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black">SCRAMBLE SHIP</Button>
            <Button variant="outline" onClick={onExit} className="mt-4 border-white/10">Back to Arcade</Button>
          </div>
        )}

        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-md">
            <h3 className="text-5xl font-black text-[#FF003C] mb-2">HULL BREACH</h3>
            <div className="text-4xl font-black text-white mb-8">{score}</div>
            <div className="flex gap-4">
              <Button onClick={() => onComplete(score)} className="bg-[#00F0FF] text-black hover:bg-white">Save Score Onchain</Button>
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
