import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Sword, Play, Trophy, Loader2, Medal, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/supabase';

export function Leaderboard({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('leaderboards')
          .select('*')
          .eq('game_id', gameId)
          .order('score', { ascending: false })
          .limit(10);

        if (error) throw error;
        setEntries(data || []);
      } catch (error) {
        console.error("Leaderboard error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();

    // Real-time subscription
    const channel = supabase
      .channel('leaderboard_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'leaderboards',
        filter: `game_id=eq.${gameId}`
      }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Top Players</h4>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-white/40 text-center py-4 italic">No scores yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold",
                  i === 0 ? "bg-yellow-500/20 text-yellow-400" : 
                  i === 1 ? "bg-slate-400/20 text-slate-300" :
                  i === 2 ? "bg-amber-600/20 text-amber-500" : "bg-white/10 text-white/40"
                )}>
                  {i + 1}
                </span>
                <span className="text-xs font-mono text-white/80">
                  {entry.user_address.substring(0, 6)}...{entry.user_address.substring(38)}
                </span>
              </div>
              <span className="text-xs font-bold text-blue-400">{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SlicingGame({ onComplete, onExit }: { onComplete: (score: number) => void; onExit: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const fruitsRef = useRef<any[]>([]);
  const particlesRef = useRef<any[]>([]);
  const trailRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const lastSpawnTime = useRef(0);
  const difficulty = useRef(1);

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    setLives(3);
    fruitsRef.current = [];
    particlesRef.current = [];
    difficulty.current = 1;
    lastSpawnTime.current = performance.now();
  };

  const spawnFruit = () => {
    const types = [
      { emoji: '🍎', color: '#ef4444' },
      { emoji: '🍊', color: '#f97316' },
      { emoji: '🍉', color: '#22c55e' },
      { emoji: '🍍', color: '#eab308' },
      { emoji: '🍓', color: '#ec4899' },
      { emoji: '🥝', color: '#84cc16' },
      { emoji: '💣', color: '#1e293b', isBomb: true }
    ];
    
    const type = types[Math.floor(Math.random() * types.length)];
    const canvas = canvasRef.current;
    if (!canvas) return;

    fruitsRef.current.push({
      id: Date.now() + Math.random(),
      x: Math.random() * (canvas.width - 100) + 50,
      y: canvas.height + 50,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -(Math.random() * 3 + 8), // Reduced initial speed
      type: type.emoji,
      color: type.color,
      isBomb: type.isBomb,
      radius: 25,
      rotation: 0,
      vr: (Math.random() - 0.5) * 0.15,
      sliced: false,
      sliceAngle: 0
    });
  };

  const createParticles = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        radius: Math.random() * 5 + 2,
        color,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  };

  const [shake, setShake] = useState(0);

  const update = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (shake > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      setShake(s => Math.max(0, s - 0.5));
    }

    if (isPlaying && !isGameOver) {
      // Difficulty scaling
      difficulty.current = 1 + Math.floor(score / 50) * 0.12;

      // Spawning
      const spawnDelay = Math.max(800, 2000 / difficulty.current);
      if (time - lastSpawnTime.current > spawnDelay) {
        spawnFruit();
        lastSpawnTime.current = time;
      }

      // Update fruits
      for (let i = fruitsRef.current.length - 1; i >= 0; i--) {
        const f = fruitsRef.current[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.18; // Reduced gravity
        f.rotation += f.vr;

        // Draw fruit
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rotation);
        ctx.font = '44px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (f.sliced) {
          // Draw two halves with offset
          ctx.save();
          ctx.rotate(f.sliceAngle);
          ctx.globalAlpha = f.life || 1;
          
          // Left half
          ctx.save();
          ctx.translate(-15, -5);
          ctx.rotate(-0.2);
          ctx.fillText(f.type, 0, 0);
          ctx.restore();
          
          // Right half
          ctx.save();
          ctx.translate(15, 5);
          ctx.rotate(0.2);
          ctx.fillText(f.type, 0, 0);
          ctx.restore();
          
          ctx.restore();
          
          f.life = (f.life || 1) - 0.02;
          if (f.life <= 0) {
            fruitsRef.current.splice(i, 1);
            ctx.restore();
            continue;
          }
        } else {
          // Glow effect for bombs
          if (f.isBomb) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ef4444';
          }
          ctx.fillText(f.type, 0, 0);
          ctx.shadowBlur = 0;
        }
        ctx.restore();

        // Check if missed
        if (f.y > canvas.height + 100) {
          if (!f.sliced && !f.isBomb) {
            setLives(l => {
              if (l <= 1) {
                setIsGameOver(true);
                setIsPlaying(false);
                onComplete(score);
                return 0;
              }
              return l - 1;
            });
          }
          fruitsRef.current.splice(i, 1);
        }
      }

      // Update particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= p.decay;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw trail (Slash Effect)
      if (trailRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
        for (let i = 1; i < trailRef.current.length; i++) {
          ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
        }
        
        const gradient = ctx.createLinearGradient(
          trailRef.current[0].x, trailRef.current[0].y,
          trailRef.current[trailRef.current.length-1].x, trailRef.current[trailRef.current.length-1].y
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.9)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#3b82f6';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Clean up old trail points
      const now = performance.now();
      trailRef.current = trailRef.current.filter(p => now - p.time < 120);
    }

    if (shake > 0) ctx.restore();
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isGameOver, score, shake]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPlaying || isGameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Scale coordinates to match canvas internal resolution (800x450)
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    trailRef.current.push({ x, y, time: performance.now() });

    // Check for slicing
    for (let i = 0; i < fruitsRef.current.length; i++) {
      const f = fruitsRef.current[i];
      if (!f.sliced) {
        const dist = Math.sqrt((f.x - x) ** 2 + (f.y - y) ** 2);
        if (dist < f.radius + 15) {
          if (f.isBomb) {
            setIsGameOver(true);
            setIsPlaying(false);
            onComplete(score);
            setShake(20);
            createParticles(f.x, f.y, '#ef4444', 30);
          } else {
            f.sliced = true;
            f.life = 1.0;
            f.vx *= 1.5;
            f.vy = -2;
            f.vr *= 4;
            f.sliceAngle = Math.atan2(y - f.y, x - f.x);
            setScore(s => s + 1);
            setShake(5);
            createParticles(f.x, f.y, f.color);
          }
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-white/40 hover:text-white">
          ← Exit Game
        </Button>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-full", i < lives ? "bg-red-500" : "bg-white/10")} />
          ))}
        </div>
      </div>

      <div className="relative h-[450px] w-full bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full cursor-crosshair touch-none"
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
        />

        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <h3 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase italic">Base Ninja</h3>
            <p className="text-white/60 text-sm mb-8">Slice the fruit, avoid the bombs!</p>
            <Button size="lg" onClick={startGame} className="px-12 py-6 text-xl font-bold bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20">
              PLAY NOW
            </Button>
          </div>
        )}

        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 p-6 text-center backdrop-blur-md"
          >
            <Trophy className="w-20 h-20 text-yellow-400 mb-4" />
            <h3 className="text-4xl font-black text-white mb-2">GAME OVER</h3>
            <div className="text-6xl font-black text-blue-400 mb-8">{score}</div>
            <div className="flex gap-4">
              <Button size="lg" onClick={startGame}>Try Again</Button>
              <Button variant="outline" size="lg" onClick={onExit}>Exit</Button>
            </div>
          </motion.div>
        )}

        {isPlaying && !isGameOver && (
          <div className="absolute top-6 left-6 pointer-events-none">
            <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Score</div>
            <div className="text-4xl font-black text-white tracking-tighter">{score}</div>
          </div>
        )}
      </div>
      <Leaderboard gameId="FruitNinja" />
    </div>
  );
}

export function EndlessRunner({ onComplete, onExit }: { onComplete: (score: number) => void; onExit: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  const player = useRef({
    y: 0,
    vy: 0,
    width: 40,
    height: 40,
    isJumping: false,
    frame: 0
  });

  const obstacles = useRef<any[]>([]);
  const particles = useRef<any[]>([]);
  const backgroundX = useRef(0);
  const lastObstacleTime = useRef(0);
  const gameSpeed = useRef(5);

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    player.current = { y: 0, vy: 0, width: 40, height: 40, isJumping: false, frame: 0 };
    obstacles.current = [];
    particles.current = [];
    gameSpeed.current = 5;
    lastObstacleTime.current = performance.now();
  };

  const jump = () => {
    if (!player.current.isJumping && isPlaying && !isGameOver) {
      player.current.vy = 14;
      player.current.isJumping = true;
    }
  };

  const update = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying && !isGameOver) {
      // Sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGradient.addColorStop(0, '#020617');
      skyGradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant Stars
      ctx.fillStyle = 'white';
      for (let i = 0; i < 20; i++) {
        const x = (backgroundX.current * 0.05 + i * 100) % canvas.width;
        const y = (i * 37) % (canvas.height - 100);
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Background parallax (Distant Cyber City)
      for (let i = 0; i < 8; i++) {
        const x = (backgroundX.current * 0.15 + i * 200) % (canvas.width + 200) - 200;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, canvas.height - 180, 120, 140);
        // Windows
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 3; col++) {
            ctx.fillRect(x + 15 + col * 30, canvas.height - 170 + row * 25, 15, 15);
          }
        }
      }

      // Ground
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
      
      // Ground grid lines
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        const x = (backgroundX.current + i) % canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 40);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Ground glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#3b82f6';
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, canvas.height - 42, canvas.width, 2);
      ctx.shadowBlur = 0;

      // Player physics
      player.current.y += player.current.vy;
      player.current.vy -= 0.7; // Gravity
      
      if (player.current.y <= 0) {
        player.current.y = 0;
        player.current.vy = 0;
        player.current.isJumping = false;
      }

      // Draw player
      const px = 100;
      const py = canvas.height - 40 - player.current.height - player.current.y;
      
      // Squash and stretch
      let drawWidth = player.current.width;
      let drawHeight = player.current.height;
      if (player.current.isJumping) {
        if (player.current.vy > 0) {
          drawHeight += 10;
          drawWidth -= 5;
        } else {
          drawHeight -= 5;
          drawWidth += 5;
        }
      }

      // Player tilt animation
      ctx.save();
      ctx.translate(px + drawWidth/2, py + drawHeight/2);
      if (!player.current.isJumping) {
        ctx.rotate(Math.sin(time / 100) * 0.1);
      }
      
      // Player body
      ctx.fillStyle = '#3b82f6';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(-drawWidth/2, -drawHeight/2, drawWidth, drawHeight, 10);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Player eye
      ctx.fillStyle = 'white';
      ctx.fillRect(drawWidth/2 - 15, -drawHeight/2 + 10, 10, 10);
      ctx.restore();
      
      // Running particles
      if (!player.current.isJumping) {
        if (Math.random() > 0.5) {
          particles.current.push({
            x: px,
            y: canvas.height - 45,
            vx: -2 - Math.random() * 2,
            vy: -Math.random() * 2,
            life: 1.0,
            decay: 0.05,
            color: 'rgba(59, 130, 246, 0.4)',
            radius: Math.random() * 3 + 1
          });
        }
      }

      // Update particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Obstacles
      gameSpeed.current = 6 + (score / 200);
      backgroundX.current -= gameSpeed.current;

      if (time - lastObstacleTime.current > Math.max(600, 1600 - score * 1.2)) {
        obstacles.current.push({
          x: canvas.width,
          width: 30 + Math.random() * 20,
          height: 40 + Math.random() * 50,
          color: Math.random() > 0.5 ? '#f43f5e' : '#fbbf24',
          type: Math.random() > 0.7 ? 'spike' : 'block'
        });
        lastObstacleTime.current = time;
      }

      for (let i = obstacles.current.length - 1; i >= 0; i--) {
        const o = obstacles.current[i];
        o.x -= gameSpeed.current;

        // Draw obstacle with glow
        ctx.fillStyle = o.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = o.color;
        
        if (o.type === 'spike') {
          ctx.beginPath();
          ctx.moveTo(o.x, canvas.height - 40);
          ctx.lineTo(o.x + o.width/2, canvas.height - 40 - o.height);
          ctx.lineTo(o.x + o.width, canvas.height - 40);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(o.x, canvas.height - 40 - o.height, o.width, o.height, 6);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Collision
        const tolerance = 10;
        if (
          px + tolerance < o.x + o.width &&
          px + drawWidth - tolerance > o.x &&
          py + drawHeight - tolerance > canvas.height - 40 - o.height
        ) {
          setIsGameOver(true);
          setIsPlaying(false);
          onComplete(score);
        }

        if (o.x < -100) {
          obstacles.current.splice(i, 1);
          setScore(s => s + 10);
        }
      }
    }

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isGameOver, score]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-white/40 hover:text-white">
          ← Exit Game
        </Button>
        <div className="text-xs font-mono text-white/40 uppercase tracking-widest">Endless Run</div>
      </div>

      <div className="relative h-[300px] w-full bg-slate-900 rounded-2xl overflow-hidden border border-white/10" onClick={jump}>
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full h-full cursor-pointer touch-action-none"
        />

        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <Play className="w-16 h-16 text-green-400 mb-4" />
            <h3 className="text-3xl font-black text-white mb-2 uppercase italic">Base Runner</h3>
            <p className="text-white/60 text-sm mb-8">Click or Tap to Jump</p>
            <Button size="lg" onClick={startGame}>START RUN</Button>
          </div>
        )}

        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center"
          >
            <Medal className="w-16 h-16 text-blue-400 mb-4" />
            <h3 className="text-3xl font-black text-white mb-2">RUN ENDED</h3>
            <div className="text-5xl font-black text-blue-400 mb-8">{score}</div>
            <div className="flex gap-4">
              <Button size="lg" onClick={startGame}>Restart</Button>
              <Button variant="outline" size="lg" onClick={onExit}>Exit</Button>
            </div>
          </motion.div>
        )}

        {isPlaying && !isGameOver && (
          <div className="absolute top-6 left-6 pointer-events-none">
            <div className="text-4xl font-black text-white tracking-tighter">{score}</div>
          </div>
        )}
      </div>
      <Leaderboard gameId="BaseRunner" />
    </div>
  );
}

export function NeonDefender({ onComplete, onExit }: { onComplete: (score: number) => void; onExit: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  const player = useRef({ angle: 0, radius: 40, x: 400, y: 225 });
  const bullets = useRef<any[]>([]);
  const enemies = useRef<any[]>([]);
  const particles = useRef<any[]>([]);
  const [shake, setShake] = useState(0);
  const lastSpawnTime = useRef(0);
  const lastShootTime = useRef(0);

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    setWave(1);
    bullets.current = [];
    enemies.current = [];
    particles.current = [];
    lastSpawnTime.current = performance.now();
  };

  const createExplosion = (x: number, y: number, color: string, count = 15) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1.0,
        decay: Math.random() * 0.02 + 0.02,
        color,
        radius: Math.random() * 4 + 1
      });
    }
  };

  const update = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shake > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      setShake(s => Math.max(0, s - 0.8));
    }

    if (isPlaying && !isGameOver) {
      // Draw Base
      ctx.beginPath();
      ctx.arc(player.current.x, player.current.y, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#3b82f6';
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Core pulse
      const pulse = Math.sin(time / 200) * 5 + 15;
      ctx.beginPath();
      ctx.arc(player.current.x, player.current.y, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fill();

      // Draw Player (Turret)
      const turretX = player.current.x + Math.cos(player.current.angle) * player.current.radius;
      const turretY = player.current.y + Math.sin(player.current.angle) * player.current.radius;
      
      ctx.save();
      ctx.translate(turretX, turretY);
      ctx.rotate(player.current.angle);
      ctx.fillStyle = '#60a5fa';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#60a5fa';
      ctx.fillRect(-10, -5, 20, 10);
      ctx.fillRect(5, -3, 15, 6);
      ctx.restore();

      // Wave management
      setWave(Math.floor(score / 200) + 1);

      // Spawning enemies from edges
      const spawnDelay = Math.max(300, 1200 - (wave * 100));
      if (time - lastSpawnTime.current > spawnDelay) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 500;
        enemies.current.push({
          x: player.current.x + Math.cos(angle) * dist,
          y: player.current.y + Math.sin(angle) * dist,
          speed: 1.5 + (wave * 0.2),
          radius: 12 + Math.random() * 8,
          color: ['#f43f5e', '#fbbf24', '#a855f7'][Math.floor(Math.random() * 3)],
          hp: 1 + Math.floor(wave / 3)
        });
        lastSpawnTime.current = time;
      }

      // Update bullets
      for (let i = bullets.current.length - 1; i >= 0; i--) {
        const b = bullets.current[i];
        b.x += b.vx;
        b.y += b.vy;
        
        ctx.fillStyle = '#60a5fa';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#60a5fa';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (Math.abs(b.x - player.current.x) > 600 || Math.abs(b.y - player.current.y) > 600) {
          bullets.current.splice(i, 1);
        }
      }

      // Update particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        
        if (p.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Update enemies
      for (let i = enemies.current.length - 1; i >= 0; i--) {
        const e = enemies.current[i];
        const angleToBase = Math.atan2(player.current.y - e.y, player.current.x - e.x);
        e.x += Math.cos(angleToBase) * e.speed;
        e.y += Math.sin(angleToBase) * e.speed;
        
        // Enemy visual
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner core
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Collision with base
        const distToBase = Math.sqrt((e.x - player.current.x) ** 2 + (e.y - player.current.y) ** 2);
        if (distToBase < 30 + e.radius) {
          setIsGameOver(true);
          setIsPlaying(false);
          onComplete(score);
          setShake(30);
          createExplosion(player.current.x, player.current.y, '#ef4444', 50);
        }

        // Collision with bullets
        for (let j = bullets.current.length - 1; j >= 0; j--) {
          const b = bullets.current[j];
          const dist = Math.sqrt((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
          if (dist < e.radius + 5) {
            e.hp--;
            bullets.current.splice(j, 1);
            if (e.hp <= 0) {
              createExplosion(e.x, e.y, e.color);
              enemies.current.splice(i, 1);
              setScore(s => s + 20);
              setShake(3);
            } else {
              setShake(1);
            }
            break;
          }
        }
      }
    }

    if (shake > 0) ctx.restore();
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isGameOver, score, shake]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPlaying || isGameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    player.current.angle = Math.atan2(y - player.current.y, x - player.current.x);
  };

  const shoot = () => {
    if (!isPlaying || isGameOver) return;
    const now = performance.now();
    if (now - lastShootTime.current > 150) {
      const turretX = player.current.x + Math.cos(player.current.angle) * player.current.radius;
      const turretY = player.current.y + Math.sin(player.current.angle) * player.current.radius;
      
      bullets.current.push({ 
        x: turretX, 
        y: turretY, 
        vx: Math.cos(player.current.angle) * 10,
        vy: Math.sin(player.current.angle) * 10
      });
      lastShootTime.current = now;
      setShake(2);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-white/40 hover:text-white">
          ← Exit Game
        </Button>
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">Wave {wave}</div>
          <div className="text-xs font-mono text-white/40 uppercase tracking-widest">Neon Defender</div>
        </div>
      </div>

      <div 
        className="relative h-[450px] w-full bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl touch-none overscroll-none"
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onClick={shoot}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full cursor-crosshair"
        />

        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <div className="w-20 h-20 rounded-full border-4 border-blue-500 flex items-center justify-center mb-6 animate-pulse">
              <Rocket className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">Neon Defender</h3>
            <p className="text-white/60 text-sm mb-8">Defend the core from incoming waves!</p>
            <Button size="lg" onClick={startGame} className="px-12 py-6 text-xl font-bold bg-blue-600 hover:bg-blue-500">START DEFENSE</Button>
          </div>
        )}

        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 p-6 text-center backdrop-blur-md"
          >
            <h3 className="text-4xl font-black text-red-500 mb-2">CORE DESTROYED</h3>
            <div className="text-6xl font-black text-white mb-8">{score}</div>
            <div className="flex gap-4">
              <Button size="lg" onClick={startGame}>Rebuild</Button>
              <Button variant="outline" size="lg" onClick={onExit}>Exit</Button>
            </div>
          </motion.div>
        )}

        {isPlaying && !isGameOver && (
          <div className="absolute top-6 left-6 pointer-events-none">
            <div className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">{score}</div>
          </div>
        )}
      </div>
      <Leaderboard gameId="NeonDefender" />
    </div>
  );
}
