'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Direction, DuelSnakeState, PlayerId } from './engine';
import { DuelSnakeGame } from './engine';
import { PLAYER_COLORS } from './constants';
import { GameBoard } from './game-board';

const KEY_BINDINGS: Record<string, { player: PlayerId; direction: Direction }> = {
  arrowup: { player: 'p1', direction: 'up' },
  arrowdown: { player: 'p1', direction: 'down' },
  arrowleft: { player: 'p1', direction: 'left' },
  arrowright: { player: 'p1', direction: 'right' },
  w: { player: 'p2', direction: 'up' },
  s: { player: 'p2', direction: 'down' },
  a: { player: 'p2', direction: 'left' },
  d: { player: 'p2', direction: 'right' },
};

const DEFAULT_TICK_MS = Math.round(140 / 0.75);

type ThemeMode = 'light' | 'dark' | 'system';
type ClassValue = string | false | null | undefined;

export interface DuelSnakeExperienceProps {
  initialSeed?: string;
  initialTheme?: ThemeMode;
  tickIntervalMs?: number;
}

function classNames(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

function createGame(seed?: string, tickIntervalMs?: number) {
  return new DuelSnakeGame({
    seed,
    tickIntervalMs: tickIntervalMs ?? DEFAULT_TICK_MS,
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

function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean) {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

function useTheme(initialMode: ThemeMode = 'light') {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(initialMode, false));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setResolvedTheme(resolveTheme(mode, false));
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (matches: boolean) => {
      setResolvedTheme(resolveTheme(mode, matches));
    };

    applyTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return { mode, setMode, resolvedTheme } as const;
}

export function DuelSnakeExperience({ initialSeed, initialTheme = 'light', tickIntervalMs }: DuelSnakeExperienceProps) {
  const [game, setGame] = useState(() => createGame(initialSeed, tickIntervalMs));
  const [state, setState] = useState<DuelSnakeState>(() => game.getState());
  const { mode: themeMode, setMode: setThemeMode, resolvedTheme } = useTheme(initialTheme);

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
    const next = createGame(`${Date.now()}`, tickIntervalMs);
    setGame(next);
    setState(next.getState());
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-800/80 dark:ring-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">本地 2P 贪吃蛇（方向键 vs WASD）</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                方向键控制 P1，WASD 控制 P2，先吃到 {state.targetScore} 分获胜。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                主题
                <select
                  aria-label="主题"
                  value={themeMode}
                  onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-sky-400">
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                  <option value="system">跟随系统</option>
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={start}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-400 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:ring-offset-slate-900">
                  开始对战
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:focus-visible:ring-offset-slate-900">
                  重新开始
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-300">
            <span>当前主题：{resolvedTheme === 'dark' ? '深色' : '浅色'}</span>
            <span>按键：P1 方向键 / P2 WASD</span>
            <span>Tick：{state.tickIntervalMs} ms</span>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="flex min-h-[64px] items-center justify-between rounded-xl bg-white/80 px-5 py-4 text-sm font-medium shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700 md:col-span-2">
            <div className="space-y-1 text-left">
              <div className="text-slate-500 dark:text-slate-300">状态</div>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{statusText}</div>
            </div>
            <div className="text-right text-sm text-slate-500 dark:text-slate-300">目标得分：{state.targetScore}</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-white/80 px-5 py-4 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              aria-label={`P1 分数: ${state.players.p1.score}`}
              title="P1 分数标记"
              style={{
                backgroundColor: PLAYER_COLORS.p1.light,
                color: PLAYER_COLORS.p1.text,
                boxShadow: `0 0 0 1px ${PLAYER_COLORS.p1.stroke}`,
              }}>
              <span
                className="h-3 w-3 rounded-sm"
                aria-hidden
                style={{
                  backgroundColor: PLAYER_COLORS.p1.primary,
                  boxShadow: `0 0 0 1px ${PLAYER_COLORS.p1.stroke}`,
                }}
                title="P1 配色"
              />
              <span className="font-semibold">P1 分数: {state.players.p1.score}</span>
            </div>
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              aria-label={`P2 分数: ${state.players.p2.score}`}
              title="P2 分数标记"
              style={{
                backgroundColor: PLAYER_COLORS.p2.light,
                color: PLAYER_COLORS.p2.text,
                boxShadow: `0 0 0 1px ${PLAYER_COLORS.p2.stroke}`,
              }}>
              <span
                className="h-3 w-3 rounded-sm"
                aria-hidden
                style={{
                  backgroundColor: PLAYER_COLORS.p2.primary,
                  boxShadow: `0 0 0 1px ${PLAYER_COLORS.p2.stroke}`,
                }}
                title="P2 配色"
              />
              <span className="font-semibold">P2 分数: {state.players.p2.score}</span>
            </div>
            {state.winner && (
              <div
                className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-900/40 dark:text-amber-50 dark:ring-amber-800"
                aria-label={`胜者：${state.winner.toUpperCase()}`}>
                <span className="font-semibold">胜者：{state.winner.toUpperCase()}</span>
              </div>
            )}
          </div>
        </section>

        <GameBoard
          state={state}
          testId="board-grid"
        />
      </div>
    </div>
  );
}

export default DuelSnakeExperience;
