import { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../ui/GlassUI';
import { Sword, Play, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

export function SlicingGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [fruits, setFruits] = useState<{ id: number; x: number; y: number; type: string }[]>([]);
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
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
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const moveInterval = setInterval(() => {
      setFruits(prev => {
        const next = prev.map(f => ({ ...f, y: f.y - 2 })).filter(f => f.y > -10);
        if (next.length < prev.length && prev.some(f => f.y <= -10)) {
          // Missed a fruit
        }
        return next;
      });
    }, 16);
    return () => clearInterval(moveInterval);
  }, [isPlaying]);

  const sliceFruit = (id: number) => {
    setScore(s => s + 1);
    setFruits(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="relative h-[400px] w-full bg-slate-900 rounded-xl overflow-hidden cursor-crosshair" ref={gameRef}>
      {!isPlaying ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
          <Sword className="w-16 h-16 text-blue-400 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-4">Fruit Slicer</h3>
          <Button onClick={() => { setIsPlaying(true); setScore(0); }}>Start Game</Button>
        </div>
      ) : (
        <>
          <div className="absolute top-4 left-4 text-white text-xl font-bold z-20">Score: {score}</div>
          <Button 
            variant="outline" 
            className="absolute top-4 right-4 z-20"
            onClick={() => { setIsPlaying(false); onComplete(score); }}
          >
            Finish & Submit
          </Button>
          <AnimatePresence>
            {fruits.map(fruit => (
              <motion.div
                key={fruit.id}
                initial={{ bottom: '0%', left: `${fruit.x}%` }}
                animate={{ bottom: `${100 - fruit.y}%` }}
                exit={{ scale: 2, opacity: 0 }}
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
  );
}

export function EndlessRunner({ onComplete }: { onComplete: (score: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [playerY, setPlayerY] = useState(0);
  const [obstacles, setObstacles] = useState<{ id: number; x: number }[]>([]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setObstacles(prev => [...prev, { id: Date.now(), x: 100 }]);
      setScore(s => s + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const moveInterval = setInterval(() => {
      setObstacles(prev => {
        const next = prev.map(o => ({ ...o, x: o.x - 1 })).filter(o => o.x > -10);
        // Collision check
        const collision = next.find(o => o.x > 5 && o.x < 15 && playerY < 20);
        if (collision) {
          setIsPlaying(false);
          onComplete(score);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(moveInterval);
  }, [isPlaying, playerY, score]);

  const jump = () => {
    if (playerY === 0) {
      setPlayerY(50);
      setTimeout(() => setPlayerY(0), 500);
    }
  };

  return (
    <div className="relative h-[200px] w-full bg-slate-800 rounded-xl overflow-hidden" onClick={jump}>
      {!isPlaying ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
          <Play className="w-12 h-12 text-green-400 mb-2" />
          <h3 className="text-xl font-bold text-white mb-2">Base Runner</h3>
          <Button onClick={() => { setIsPlaying(true); setScore(0); setObstacles([]); }}>Start</Button>
        </div>
      ) : (
        <>
          <div className="absolute top-2 left-2 text-white font-bold">Score: {score}</div>
          <div 
            className="absolute bottom-4 left-8 w-8 h-8 bg-blue-500 rounded-lg transition-all duration-300"
            style={{ bottom: `${playerY + 16}px` }}
          />
          {obstacles.map(o => (
            <div 
              key={o.id}
              className="absolute bottom-4 w-6 h-12 bg-red-500 rounded-t-lg"
              style={{ left: `${o.x}%` }}
            />
          ))}
          <div className="absolute bottom-4 w-full h-1 bg-slate-600" />
        </>
      )}
    </div>
  );
}

export function TileMatch({ onComplete }: { onComplete: (score: number) => void }) {
    const [tiles, setTiles] = useState<string[]>([]);
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const icons = ['💎', '🚀', '🔥', '🌈', '⚡', '🦄'];

    const start = () => {
        const shuffled = [...icons, ...icons].sort(() => Math.random() - 0.5);
        setTiles(shuffled);
        setMatched([]);
        setFlipped([]);
        setIsPlaying(true);
    };

    const handleFlip = (idx: number) => {
        if (flipped.length === 2 || matched.includes(idx) || flipped.includes(idx)) return;
        const newFlipped = [...flipped, idx];
        setFlipped(newFlipped);

        if (newFlipped.length === 2) {
            if (tiles[newFlipped[0]] === tiles[newFlipped[1]]) {
                setMatched(prev => [...prev, ...newFlipped]);
                setFlipped([]);
                if (matched.length + 2 === tiles.length) {
                    setIsPlaying(false);
                    onComplete(100);
                }
            } else {
                setTimeout(() => setFlipped([]), 1000);
            }
        }
    };

    return (
        <div className="p-4 bg-slate-900 rounded-xl min-h-[300px] flex flex-col items-center justify-center">
            {!isPlaying ? (
                <Button onClick={start}>Start Tile Match</Button>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    {tiles.map((tile, i) => (
                        <div 
                            key={i}
                            onClick={() => handleFlip(i)}
                            className={cn(
                                "w-14 h-14 flex items-center justify-center text-2xl rounded-lg cursor-pointer transition-all duration-300",
                                flipped.includes(i) || matched.includes(i) ? "bg-white/20 rotate-y-180" : "bg-blue-600"
                            )}
                        >
                            {(flipped.includes(i) || matched.includes(i)) ? tile : '?'}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
