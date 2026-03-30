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
      vx: (Math.random() - 0.5) * 4,
      vy: -(Math.random() * 5 + 12),
      type: type.emoji,
      color: type.color,
      isBomb: type.isBomb,
      radius: 25,
      rotation: 0,
      vr: (Math.random() - 0.5) * 0.2,
      sliced: false
    });
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        radius: Math.random() * 4 + 2,
        color,
        life: 1.0,
        decay: Math.random() * 0.02 + 0.02
      });
    }
  };

  const update = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying && !isGameOver) {
      // Difficulty scaling
      difficulty.current = 1 + Math.floor(score / 50) * 0.2;

      // Spawning
      const spawnDelay = Math.max(400, 1200 / difficulty.current);
      if (time - lastSpawnTime.current > spawnDelay) {
        spawnFruit();
        lastSpawnTime.current = time;
      }

      // Update fruits
      for (let i = fruitsRef.current.length - 1; i >= 0; i--) {
        const f = fruitsRef.current[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.25; // Gravity
        f.rotation += f.vr;

        // Draw fruit
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rotation);
        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (f.sliced) {
          // Draw two halves
          ctx.globalAlpha = f.opacity || 1;
          ctx.fillText(f.type, -10, 0);
          ctx.fillText(f.type, 10, 0);
        } else {
          ctx.fillText(f.type, 0, 0);
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
        p.vy += 0.1;
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

      // Draw trail
      if (trailRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
        for (let i = 1; i < trailRef.current.length; i++) {
          ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
        }
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Clean up old trail points
      const now = performance.now();
      trailRef.current = trailRef.current.filter(p => now - p.time < 150);
    }

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isGameOver, score]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPlaying || isGameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    trailRef.current.push({ x, y, time: performance.now() });

    // Check for slicing
    for (let i = 0; i < fruitsRef.current.length; i++) {
      const f = fruitsRef.current[i];
      if (!f.sliced) {
        const dist = Math.sqrt((f.x - x) ** 2 + (f.y - y) ** 2);
        if (dist < f.radius + 10) {
          if (f.isBomb) {
            setIsGameOver(true);
            setIsPlaying(false);
            onComplete(score);
            createParticles(f.x, f.y, '#f87171');
          } else {
            f.sliced = true;
            f.vx *= 2;
            f.vr *= 5;
            setScore(s => s + 1);
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
  const backgroundX = useRef(0);
  const lastObstacleTime = useRef(0);
  const gameSpeed = useRef(5);

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    player.current = { y: 0, vy: 0, width: 40, height: 40, isJumping: false, frame: 0 };
    obstacles.current = [];
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
      skyGradient.addColorStop(0, '#0f172a');
      skyGradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Background parallax (Distant buildings)
      ctx.fillStyle = '#0f172a';
      for (let i = 0; i < 10; i++) {
        const x = (backgroundX.current * 0.2 + i * 150) % (canvas.width + 150) - 150;
        ctx.fillRect(x, canvas.height - 120, 80, 80);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x + 10, canvas.height - 110, 10, 10);
        ctx.fillStyle = '#0f172a';
      }

      // Ground
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
      
      // Ground glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#3b82f6';
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, canvas.height - 42, canvas.width, 2);
      ctx.shadowBlur = 0;

      // Player physics
      player.current.y += player.current.vy;
      player.current.vy -= 0.6; // Gravity
      
      if (player.current.y <= 0) {
        player.current.y = 0;
        player.current.vy = 0;
        player.current.isJumping = false;
      }

      // Draw player
      const px = 100;
      const py = canvas.height - 40 - player.current.height - player.current.y;
      
      // Player body
      ctx.fillStyle = '#3b82f6';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(px, py, player.current.width, player.current.height, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Player eye
      ctx.fillStyle = 'white';
      ctx.fillRect(px + 25, py + 10, 8, 8);
      
      // Jump particles
      if (player.current.isJumping) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.beginPath();
        ctx.arc(px + 20, py + 45, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Obstacles
      gameSpeed.current = 5 + (score / 150);
      backgroundX.current -= gameSpeed.current;

      if (time - lastObstacleTime.current > Math.max(700, 1800 - score * 1.5)) {
        obstacles.current.push({
          x: canvas.width,
          width: 35,
          height: 45 + Math.random() * 40,
          color: Math.random() > 0.5 ? '#ef4444' : '#f97316'
        });
        lastObstacleTime.current = time;
      }

      for (let i = obstacles.current.length - 1; i >= 0; i--) {
        const o = obstacles.current[i];
        o.x -= gameSpeed.current;

        // Draw obstacle with glow
        ctx.fillStyle = o.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = o.color;
        ctx.beginPath();
        ctx.roundRect(o.x, canvas.height - 40 - o.height, o.width, o.height, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Collision
        if (
          px < o.x + o.width &&
          px + player.current.width > o.x &&
          py + player.current.height > canvas.height - 40 - o.height
        ) {
          setIsGameOver(true);
          setIsPlaying(false);
          onComplete(score);
        }

        if (o.x < -50) {
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
          className="w-full h-full cursor-pointer"
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

export function BaseInvaders({ onComplete, onExit }: { onComplete: (score: number) => void; onExit: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  const player = useRef({ x: 400, y: 350, width: 40, height: 40 });
  const bullets = useRef<any[]>([]);
  const enemies = useRef<any[]>([]);
  const particles = useRef<any[]>([]);
  const lastSpawnTime = useRef(0);
  const lastShootTime = useRef(0);

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    bullets.current = [];
    enemies.current = [];
    particles.current = [];
    lastSpawnTime.current = performance.now();
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  };

  const update = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying && !isGameOver) {
      // Draw player
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚀', player.current.x, player.current.y);

      // Spawning enemies
      if (time - lastSpawnTime.current > Math.max(500, 1500 - score / 10)) {
        enemies.current.push({
          id: Date.now() + Math.random(),
          x: Math.random() * (canvas.width - 60) + 30,
          y: -50,
          speed: 2 + Math.random() * 2 + (score / 1000),
          type: ['👾', '🛸', '👻', '💀'][Math.floor(Math.random() * 4)],
          hp: 1
        });
        lastSpawnTime.current = time;
      }

      // Update bullets
      for (let i = bullets.current.length - 1; i >= 0; i--) {
        const b = bullets.current[i];
        b.y -= 7;
        
        ctx.fillStyle = '#60a5fa';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#60a5fa';
        ctx.fillRect(b.x - 2, b.y, 4, 15);
        ctx.shadowBlur = 0;

        if (b.y < -20) bullets.current.splice(i, 1);
      }

      // Update particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        
        if (p.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Update enemies
      for (let i = enemies.current.length - 1; i >= 0; i--) {
        const e = enemies.current[i];
        e.y += e.speed;
        
        // Sinusoidal movement
        e.x += Math.sin(e.y / 30) * 2;

        ctx.font = '35px serif';
        ctx.fillText(e.type, e.x, e.y);

        // Collision with player
        const distToPlayer = Math.sqrt((e.x - player.current.x) ** 2 + (e.y - player.current.y) ** 2);
        if (distToPlayer < 35 || e.y > canvas.height) {
          setIsGameOver(true);
          setIsPlaying(false);
          onComplete(score);
          createExplosion(player.current.x, player.current.y, '#ef4444');
        }

        // Collision with bullets
        for (let j = bullets.current.length - 1; j >= 0; j--) {
          const b = bullets.current[j];
          const dist = Math.sqrt((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
          if (dist < 25) {
            createExplosion(e.x, e.y, '#60a5fa');
            enemies.current.splice(i, 1);
            bullets.current.splice(j, 1);
            setScore(s => s + 10);
            break;
          }
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPlaying || isGameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    player.current.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  };

  const shoot = () => {
    if (!isPlaying || isGameOver) return;
    const now = performance.now();
    if (now - lastShootTime.current > 200) {
      bullets.current.push({ x: player.current.x, y: player.current.y - 20 });
      lastShootTime.current = now;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-white/40 hover:text-white">
          ← Exit Game
        </Button>
        <div className="text-xs font-mono text-white/40 uppercase tracking-widest">Base Defense</div>
      </div>

      <div 
        className="relative h-[450px] w-full bg-slate-950 rounded-2xl overflow-hidden border border-white/10"
        onMouseMove={handleMouseMove}
        onClick={shoot}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full cursor-none"
        />

        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <Rocket className="w-16 h-16 text-blue-400 mb-4" />
            <h3 className="text-3xl font-black text-white mb-2 uppercase italic">Base Invaders</h3>
            <p className="text-white/60 text-sm mb-8">Move mouse to move, Click to shoot</p>
            <Button size="lg" onClick={startGame}>START MISSION</Button>
          </div>
        )}

        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center"
          >
            <h3 className="text-3xl font-black text-white mb-2">MISSION FAILED</h3>
            <div className="text-5xl font-black text-blue-400 mb-8">{score}</div>
            <div className="flex gap-4">
              <Button size="lg" onClick={startGame}>Retry</Button>
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
      <Leaderboard gameId="BaseInvaders" />
    </div>
  );
}
