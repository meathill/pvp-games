import { useEffect, useMemo, useRef, useState } from 'react';
import type { Direction, DuelSnakeState, PlayerId } from '@pvp-games/games';
import { DuelSnakeGame } from '@pvp-games/games';
import './app.css';

type KeyBinding = {
  player: PlayerId;
  direction: Direction;
};

const KEY_BINDINGS: Record<string, KeyBinding> = {
  arrowup: { player: 'p1', direction: 'up' },
  arrowdown: { player: 'p1', direction: 'down' },
  arrowleft: { player: 'p1', direction: 'left' },
  arrowright: { player: 'p1', direction: 'right' },
  w: { player: 'p2', direction: 'up' },
  s: { player: 'p2', direction: 'down' },
  a: { player: 'p2', direction: 'left' },
  d: { player: 'p2', direction: 'right' }
};

const CELL_COLORS = {
  background: '#0b1220',
  grid: '#0f172a',
  fruit: '#f97316',
  p1: '#4ade80',
  p2: '#60a5fa'
};

function createGame(seed?: string) {
  return new DuelSnakeGame({
    seed,
    tickIntervalMs: 140
  });
}

function useGameLoop(game: DuelSnakeGame, setState: (state: DuelSnakeState) => void, tickMs: number) {
  const loopRef = useRef<number | null>(null);

  useEffect(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
    }
    loopRef.current = window.setInterval(() => {
      setState(game.tick());
    }, tickMs);

    return () => {
      if (loopRef.current) {
        clearInterval(loopRef.current);
      }
    };
  }, [game, setState, tickMs]);
}

export function App() {
  const [game, setGame] = useState(() => createGame());
  const [state, setState] = useState<DuelSnakeState>(() => game.getState());

  useGameLoop(game, setState, state.tickIntervalMs);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const binding = KEY_BINDINGS[event.key.toLowerCase()];
      if (!binding) return;
      event.preventDefault();
      game.queueInput(binding.player, binding.direction);
      setState(game.getState());
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game]);

  const statusText = useMemo(() => {
    if (state.status === 'finished') {
      if (state.winner) {
        return `比赛结束：${state.winner.toUpperCase()} 获胜`;
      }
      return '比赛已结束';
    }
    if (state.status === 'running') return '对局进行中';
    if (state.status === 'ready') return '双方已准备';
    return '等待开始';
  }, [state.status, state.winner]);

  const start = () => {
    game.ready('p1');
    game.ready('p2');
    game.start();
    setState(game.getState());
  };

  const reset = () => {
    const next = createGame(`${Date.now()}`);
    setGame(next);
    setState(next.getState());
  };

  const width = state.dimensions.width;
  const height = state.dimensions.height;
  const p1Cells = new Set(
    state.players.p1.segments.map((cell: DuelSnakeState['players']['p1']['segments'][number]) => `${cell.x},${cell.y}`)
  );
  const p2Cells = new Set(
    state.players.p2.segments.map((cell: DuelSnakeState['players']['p2']['segments'][number]) => `${cell.x},${cell.y}`)
  );
  const fruitKey = `${state.fruit.x},${state.fruit.y}`;

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>本地 2P 贪吃蛇（方向键 vs WASD）</h1>
          <p className="subtitle">方向键控制 P1，WASD 控制 P2，先吃到 {state.targetScore} 分获胜。</p>
        </div>
        <div className="actions">
          <button type="button" onClick={start}>开始对战</button>
          <button type="button" onClick={reset}>重新开始</button>
        </div>
      </header>

      <section className="status">
        <div>状态：{statusText}</div>
        <div>Tick：{state.tickIntervalMs} ms</div>
      </section>

      <section className="scoreboard">
        <div className="scoreboard__entry p1">P1 分数: {state.players.p1.score}</div>
        <div className="scoreboard__entry p2">P2 分数: {state.players.p2.score}</div>
        {state.winner && (
          <div className="scoreboard__winner">胜者：{state.winner.toUpperCase()}</div>
        )}
      </section>

      <section className="board" aria-label="对战棋盘">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gridTemplateRows: `repeat(${height}, 1fr)`,
            background: CELL_COLORS.background
          }}
        >
          {Array.from({ length: height * width }).map((_, index) => {
            const x = index % width;
            const y = Math.floor(index / width);
            const key = `${x},${y}`;
            const isP1 = p1Cells.has(key);
            const isP2 = p2Cells.has(key);
            const isFruit = key === fruitKey;
            let fill = CELL_COLORS.grid;
            if (isFruit) fill = CELL_COLORS.fruit;
            if (isP1) fill = CELL_COLORS.p1;
            if (isP2) fill = CELL_COLORS.p2;
            return <div key={key} className="cell" style={{ background: fill }} />;
          })}
        </div>
      </section>
    </div>
  );
}

export default App;
