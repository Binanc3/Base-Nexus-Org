import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Sword, Play, Trophy, Loader2, Medal, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { db } from '../../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

export function Leaderboard({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'leaderboards'),
      where('gameId', '==', gameId),
      orderBy('score', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Leaderboard error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
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
                  {entry.userAddress.substring(0, 6)}...{entry.userAddress.substring(38)}
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

export function SlicingGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [fruits, setFruits] = useState<{ id: number; x: number; y: number; type: string }[]>([]);
  const [combo, setCombo] = useState(0);
  const [lastComboTime, setLastComboTime] = useState(0);
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying || isGameOver) return;
    const interval = setInterval(() => {
      setFruits(prev => [
        ...prev,
        {
          id: Date.now(),
          x: Math.random() * 80 + 10,
          y: 100,
          type: ['🍎', '🍊', '🍉', '🍍'][Math.floor(Math.random() * 4)]
        }
      ]);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isGameOver]);

  useEffect(() => {
    if (!isPlaying || isGameOver) return;
    const moveInterval = setInterval(() => {
      setFruits(prev => {
        const next = prev.map(f => ({ ...f, y: f.y - 2 })).filter(f => f.y > -10);
        if (next.length < prev.length && prev.some(f => f.y <= -10)) {
          // Missed a fruit - end game
          setIsGameOver(true);
          setIsPlaying(false);
          onComplete(score);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(moveInterval);
  }, [isPlaying, isGameOver, score, onComplete]);

  const sliceFruit = (id: number) => {
    const now = Date.now();
    if (now - lastComboTime < 500) {
      setCombo(c => c + 1);
    } else {
      setCombo(1);
    }
    setLastComboTime(now);
    
    setScore(s => s + (1 * combo));
    setFruits(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="relative h-[400px] w-full bg-slate-900 rounded-xl overflow-hidden cursor-crosshair" ref={gameRef}>
        {!isPlaying && !isGameOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <Sword className="w-16 h-16 text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Fruit Slicer</h3>
            <p className="text-white/40 text-sm mb-6">Slice the fruit! Don't let them fall.</p>
            <Button onClick={() => { setIsPlaying(true); setIsGameOver(false); setScore(0); setCombo(0); }}>Start Game</Button>
          </div>
        ) : isGameOver ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center"
          >
            <Trophy className="w-16 h-16 text-yellow-400 mb-4" />
            <h3 className="text-3xl font-bold text-white mb-2">Game Over!</h3>
            <div className="text-5xl font-black text-blue-400 mb-6">{score}</div>
            <p className="text-white/40 text-sm mb-8">Score logged to Base Mainnet leaderboard.</p>
            <Button onClick={() => { setIsGameOver(false); setIsPlaying(true); setScore(0); setCombo(0); }}>Try Again</Button>
          </motion.div>
        ) : (
          <>
            <div className="absolute top-4 left-4 z-20">
              <motion.div 
                key={score}
                initial={{ scale: 1.5, color: '#3b82f6' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="text-white text-2xl font-bold"
              >
                Score: {score}
              </motion.div>
              {combo > 1 && (
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="text-yellow-400 text-sm font-bold italic"
                >
                  {combo}x COMBO!
                </motion.div>
              )}
            </div>
            
            <AnimatePresence>
              {fruits.map(fruit => (
                <motion.div
                  key={fruit.id}
                  initial={{ bottom: '0%', left: `${fruit.x}%` }}
                  animate={{ bottom: `${100 - fruit.y}%` }}
                  exit={{ scale: 2, opacity: 0, rotate: 45 }}
                  className="absolute text-4xl select-none"
                  onMouseEnter={() => sliceFruit(fruit.id)}
                >
                  {fruit.type}
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
      <Leaderboard gameId="FruitSlicer" />
    </div>
  );
}

export function EndlessRunner({ onComplete }: { onComplete: (score: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playerY, setPlayerY] = useState(0);
  const [obstacles, setObstacles] = useState<{ id: number; x: number }[]>([]);

  useEffect(() => {
    if (!isPlaying || isGameOver) return;
    const interval = setInterval(() => {
      setObstacles(prev => [...prev, { id: Date.now(), x: 100 }]);
      setScore(s => s + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying, isGameOver]);

  useEffect(() => {
    if (!isPlaying || isGameOver) return;
    const moveInterval = setInterval(() => {
      setObstacles(prev => {
        const next = prev.map(o => ({ ...o, x: o.x - 1 })).filter(o => o.x > -10);
        // Collision check
        const collision = next.find(o => o.x > 5 && o.x < 15 && playerY < 20);
        if (collision) {
          setIsPlaying(false);
          setIsGameOver(true);
          onComplete(score);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(moveInterval);
  }, [isPlaying, isGameOver, playerY, score, onComplete]);

  const jump = () => {
    if (playerY === 0 && isPlaying) {
      setPlayerY(50);
      setTimeout(() => setPlayerY(0), 500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative h-[200px] w-full bg-slate-800 rounded-xl overflow-hidden" onClick={jump}>
        {!isPlaying && !isGameOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <Play className="w-12 h-12 text-green-400 mb-2" />
            <h3 className="text-xl font-bold text-white mb-2">Base Runner</h3>
            <p className="text-white/40 text-xs mb-4">Click to jump over obstacles!</p>
            <Button onClick={() => { setIsPlaying(true); setIsGameOver(false); setScore(0); setObstacles([]); }}>Start</Button>
          </div>
        ) : isGameOver ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-4 text-center"
          >
            <Medal className="w-12 h-12 text-blue-400 mb-2" />
            <h3 className="text-xl font-bold text-white mb-1">Run Ended!</h3>
            <div className="text-3xl font-black text-blue-400 mb-4">{score}</div>
            <Button onClick={() => { setIsGameOver(false); setIsPlaying(true); setScore(0); setObstacles([]); }}>Restart</Button>
          </motion.div>
        ) : (
          <>
            <div className="absolute top-2 left-2 z-20">
              <motion.div 
                key={score}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-white font-bold"
              >
                Score: {score}
              </motion.div>
            </div>
            <div 
              className="absolute bottom-4 left-8 w-8 h-8 bg-blue-500 rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              style={{ bottom: `${playerY + 16}px` }}
            />
            {obstacles.map(o => (
              <div 
                key={o.id}
                className="absolute bottom-4 w-6 h-12 bg-red-500 rounded-t-lg shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                style={{ left: `${o.x}%` }}
              />
            ))}
            <div className="absolute bottom-4 w-full h-1 bg-slate-600" />
          </>
        )}
      </div>
      <Leaderboard gameId="BaseRunner" />
    </div>
  );
}

export function BaseInvaders({ onComplete }: { onComplete: (score: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playerX, setPlayerX] = useState(50);
  const [bullets, setBullets] = useState<{ id: number; x: number; y: number }[]>([]);
  const [enemies, setEnemies] = useState<{ id: number; x: number; y: number; type: string }[]>([]);
  const gameRef = useRef<HTMLDivElement>(null);

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    setBullets([]);
    setEnemies([]);
  };

  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    const spawnInterval = setInterval(() => {
      setEnemies(prev => [
        ...prev,
        {
          id: Date.now(),
          x: Math.random() * 90 + 5,
          y: 0,
          type: ['👾', '🛸', '👻', '💀'][Math.floor(Math.random() * 4)]
        }
      ]);
    }, 1200);

    const gameLoop = setInterval(() => {
      setBullets(prev => prev.map(b => ({ ...b, y: b.y - 5 })).filter(b => b.y > 0));
      setEnemies(prev => {
        const next = prev.map(e => ({ ...e, y: e.y + 1.5 }));
        if (next.some(e => e.y > 90)) {
          setIsPlaying(false);
          setIsGameOver(true);
          onComplete(score);
          return [];
        }
        return next;
      });

      // Collision detection
      setBullets(prevBullets => {
        let hitEnemies: number[] = [];
        const nextBullets = prevBullets.filter(b => {
          const hit = enemies.find(e => 
            Math.abs(e.x - b.x) < 5 && Math.abs(e.y - b.y) < 5
          );
          if (hit) {
            hitEnemies.push(hit.id);
            setScore(s => s + 10);
            return false;
          }
          return true;
        });
        if (hitEnemies.length > 0) {
          setEnemies(prev => prev.filter(e => !hitEnemies.includes(e.id)));
        }
        return nextBullets;
      });
    }, 30);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(gameLoop);
    };
  }, [isPlaying, isGameOver, enemies, score, onComplete]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!gameRef.current) return;
    const rect = gameRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setPlayerX(Math.max(5, Math.min(95, x)));
  };

  const shoot = () => {
    if (!isPlaying || isGameOver) return;
    setBullets(prev => [...prev, { id: Date.now(), x: playerX, y: 85 }]);
  };

  return (
    <div className="space-y-4 w-full">
      <div 
        ref={gameRef}
        className="relative h-[400px] w-full bg-slate-900 rounded-xl overflow-hidden cursor-none"
        onMouseMove={handleMouseMove}
        onClick={shoot}
      >
        {!isPlaying && !isGameOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <Rocket className="w-16 h-16 text-blue-400 mb-4 animate-bounce" />
            <h3 className="text-2xl font-bold text-white mb-2">Base Invaders</h3>
            <p className="text-white/40 text-sm mb-6">Protect Base from the FUD! Click to shoot.</p>
            <Button onClick={startGame}>Start Mission</Button>
          </div>
        ) : isGameOver ? (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-8 text-center"
          >
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <Rocket className="w-10 h-10 text-red-400 rotate-180" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">Mission Failed!</h3>
            <div className="text-5xl font-black text-blue-400 mb-6">{score}</div>
            <p className="text-white/40 text-sm mb-8 italic">The FUD has breached the perimeter.</p>
            <Button onClick={startGame}>Re-deploy</Button>
          </motion.div>
        ) : (
          <>
            <div className="absolute top-4 left-4 z-20">
              <motion.div 
                key={score}
                initial={{ scale: 1.3, x: -10 }}
                animate={{ scale: 1, x: 0 }}
                className="text-white text-xl font-bold"
              >
                Score: {score}
              </motion.div>
            </div>
            
            {/* Player */}
            <motion.div 
              className="absolute bottom-4 text-4xl select-none"
              style={{ left: `${playerX}%`, transform: 'translateX(-50%)' }}
            >
              🚀
            </motion.div>

            {/* Bullets */}
            {bullets.map(b => (
              <div 
                key={b.id}
                className="absolute w-1 h-4 bg-blue-400 rounded-full shadow-[0_0_10px_#3b82f6]"
                style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translateX(-50%)' }}
              />
            ))}

            {/* Enemies */}
            {enemies.map(e => (
              <motion.div
                key={e.id}
                className="absolute text-3xl select-none"
                style={{ left: `${e.x}%`, top: `${e.y}%`, transform: 'translateX(-50%)' }}
              >
                {e.type}
              </motion.div>
            ))}
          </>
        )}
      </div>
      <Leaderboard gameId="BaseInvaders" />
    </div>
  );
}
