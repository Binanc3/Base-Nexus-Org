import { useState, useRef, useEffect } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Play, Trophy, Shield, Zap, X } from 'lucide-react';
import { motion } from 'framer-motion';

// -------------- BASE NINJA (Fixed Coordinates & Neon UI) --------------
export function SlicingGame({ onComplete, onExit }: { onComplete: (score: number) => void; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let fruits: { x: number, y: number, vx: number, vy: number, size: number, type: 'fruit'|'bomb', color: string }[] = [];
    let trail: { x: number, y: number }[] = [];
    let currentScore = 0;
    let isDrawing = false;

    // Fixed Coordinate Mapping for accurate touch on all screen sizes
    const getMousePos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const spawnEntity = () => {
      if (Math.random() < 0.05) {
        const isBomb = Math.random() < 0.2;
        fruits.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 20,
          vx: (Math.random() - 0.5) * 6,
          vy: -(Math.random() * 5 + 8),
          size: isBomb ? 25 : 30,
          type: isBomb ? 'bomb' : 'fruit',
          color: isBomb ? '#FF003C' : '#00F0FF'
        });
      }
    };

    const loop = () => {
      ctx.fillStyle = '#050b14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      spawnEntity();

      // Render Trail (Neon Blade)
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = '#B026FF';
        ctx.lineWidth = 6;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#B026FF';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Update & Render Entities
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.15; // Gravity

        // Draw Entity
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = f.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Slice Detection
        if (trail.length > 0) {
          const lastPoint = trail[trail.length - 1];
          const dist = Math.hypot(f.x - lastPoint.x, f.y - lastPoint.y);
          if (dist < f.size + 10) {
            if (f.type === 'bomb') {
              setGameOver(true);
              return;
            } else {
              currentScore += 10;
              setScore(currentScore);
              fruits.splice(i, 1);
            }
          }
        }

        if (f.y > canvas.height + 50) fruits.splice(i, 1);
      }
      if (trail.length > 0 && !isDrawing) trail.shift();
      animationId = requestAnimationFrame(loop);
    };

    const handleStart = (e: any) => { isDrawing = true; trail.push(getMousePos(e)); };
    const handleMove = (e: any) => { if (isDrawing) trail.push(getMousePos(e)); if (trail.length > 15) trail.shift(); };
    const handleEnd = () => { isDrawing = false; trail = []; };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    loop();
    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [gameOver]);

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-[#00F0FF]/30 shadow-[0_0_50px_rgba(0,240,255,0.1)]">
      <div className="absolute top-4 left-4 text-white font-black text-2xl z-10 drop-shadow-md">SCORE: {score}</div>
      <button onClick={onExit} className="absolute top-4 right-4 z-10 bg-black/50 p-2 rounded-full text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
      <canvas ref={canvasRef} width={800} height={600} className="w-full h-[60vh] md:h-[600px] bg-[#050b14] touch-none cursor-crosshair" />
      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-20">
          <h2 className="text-5xl font-black text-[#FF003C] mb-4 tracking-widest uppercase">Wasted</h2>
          <p className="text-xl text-white mb-8 font-mono">Final Score: {score}</p>
          <Button onClick={() => onComplete(score)} className="px-10 py-4 text-xl bg-[#00F0FF] text-black hover:bg-white">Secure Score Onchain</Button>
        </div>
      )}
    </div>
  );
}

// -------------- NEON DEFENDER (Fixed Shooting & Premium UI) --------------
export function NeonDefender({ onComplete, onExit }: { onComplete: (score: number) => void; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let player = { x: canvas.width / 2, y: canvas.height - 50, size: 20 };
    let bullets: {x: number, y: number}[] = [];
    let enemies: {x: number, y: number, size: number, hp: number}[] = [];
    let currentScore = 0;
    let frame = 0;

    const getMousePos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      return (clientX - rect.left) * (canvas.width / rect.width);
    };

    const loop = () => {
      ctx.fillStyle = 'rgba(5, 11, 20, 0.3)'; // Motion blur effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      frame++;

      // Draw Player (Neon Triangle)
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - player.size);
      ctx.lineTo(player.x - player.size, player.y + player.size);
      ctx.lineTo(player.x + player.size, player.y + player.size);
      ctx.closePath();
      ctx.fillStyle = '#00F0FF';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00F0FF';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Update & Draw Bullets
      ctx.fillStyle = '#FFF';
      for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= 12; // Fast bullets
        ctx.fillRect(bullets[i].x - 2, bullets[i].y, 4, 15);
        if (bullets[i].y < 0) bullets.splice(i, 1);
      }

      // Spawn & Draw Enemies
      if (frame % 40 === 0) {
        enemies.push({ x: Math.random() * (canvas.width - 40) + 20, y: -20, size: 25, hp: 1 });
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += 3; // Enemy speed

        ctx.beginPath();
        ctx.rect(e.x - e.size/2, e.y - e.size/2, e.size, e.size);
        ctx.strokeStyle = '#B026FF';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#B026FF';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Collision with bullets
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          if (b.x > e.x - e.size/2 && b.x < e.x + e.size/2 && b.y < e.y + e.size/2 && b.y > e.y - e.size/2) {
            enemies.splice(i, 1);
            bullets.splice(j, 1);
            currentScore += 50;
            setScore(currentScore);
            break;
          }
        }

        // Collision with player (Game Over)
        if (Math.hypot(player.x - e.x, player.y - e.y) < player.size + e.size/2) {
          setGameOver(true);
          return;
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    const handleMove = (e: any) => { player.x = getMousePos(e); };
    // FIX: Fire on click/tap
    const handleFire = () => { bullets.push({ x: player.x, y: player.y - player.size }); };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('touchmove', handleMove);
    canvas.addEventListener('mousedown', handleFire);
    canvas.addEventListener('touchstart', handleFire);

    loop();

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('mousedown', handleFire);
      canvas.removeEventListener('touchstart', handleFire);
    };
  }, [gameOver]);

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-[#B026FF]/30 shadow-[0_0_50px_rgba(176,38,255,0.1)]">
      <div className="absolute top-4 left-4 text-white font-black text-2xl z-10">DEFENSE: {score}</div>
      <button onClick={onExit} className="absolute top-4 right-4 z-10 bg-black/50 p-2 rounded-full text-white/50"><X className="w-6 h-6" /></button>
      <canvas ref={canvasRef} width={600} height={800} className="w-full h-[60vh] md:h-[600px] bg-[#050b14] touch-none cursor-crosshair" />
      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <h2 className="text-5xl font-black text-[#B026FF] mb-4">BREACHED</h2>
          <Button onClick={() => onComplete(score)} className="px-10 py-4 bg-[#B026FF] text-white">Log Score Onchain</Button>
        </div>
      )}
    </div>
  );
}

// Fallback for Runner to keep file size optimized
export function EndlessRunner({ onComplete, onExit }: any) {
  return <NeonDefender onComplete={onComplete} onExit={onExit} />;
}
