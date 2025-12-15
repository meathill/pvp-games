'use client';

import type { DuelSnakeState } from './engine';
import { CELL_SIZE, CELL_GAP, PLAYER_COLORS, FRUIT_COLOR } from './constants';

export interface GameBoardProps {
  state: DuelSnakeState;
  testId?: string;
}

export function GameBoard({ state, testId }: GameBoardProps) {
  const { dimensions, players, fruit } = state;
  const { width, height } = dimensions;

  const p1Cells = new Set(players.p1.segments.map((cell) => `${cell.x},${cell.y}`));
  const p2Cells = new Set(players.p2.segments.map((cell) => `${cell.x},${cell.y}`));
  const fruitKey = `${fruit.x},${fruit.y}`;

  const p1Respawning = players.p1.respawnTicksRemaining > 0;
  const p2Respawning = players.p2.respawnTicksRemaining > 0;

  return (
    <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
      <div
        data-testid={testId}
        className="grid rounded-xl bg-slate-100 p-2 shadow-inner ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 overflow-auto"
        style={{
          gridTemplateColumns: `repeat(${width}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${height}, ${CELL_SIZE}px)`,
          gap: `${CELL_GAP}px`,
        }}>
        {Array.from({ length: height * width }).map((_, index) => {
          const x = index % width;
          const y = Math.floor(index / width);
          const key = `${x},${y}`;
          const isP1 = p1Cells.has(key);
          const isP2 = p2Cells.has(key);
          const isFruit = key === fruitKey;

          const fillStyle = getCellStyle(isP1, isP2, isFruit, p1Respawning, p2Respawning);
          const title = getCellTitle(x, y, isP1, isP2, isFruit, p1Respawning, p2Respawning);

          return (
            <div
              key={key}
              role="presentation"
              className="h-[18px] w-[18px] rounded-sm bg-slate-200 ring-1 ring-slate-200 transition-colors duration-75 dark:bg-slate-700 dark:ring-slate-600"
              aria-label={`cell-${x}-${y}`}
              title={title}
              style={fillStyle}
            />
          );
        })}
      </div>
    </div>
  );
}

function getCellStyle(
  isP1: boolean,
  isP2: boolean,
  isFruit: boolean,
  p1Respawning: boolean,
  p2Respawning: boolean,
): React.CSSProperties | undefined {
  if (isFruit) {
    return {
      backgroundColor: FRUIT_COLOR.primary,
      boxShadow: `0 0 0 1px ${FRUIT_COLOR.stroke}`,
    };
  }
  if (isP1) {
    return {
      backgroundColor: PLAYER_COLORS.p1.primary,
      boxShadow: `0 0 0 1px ${PLAYER_COLORS.p1.stroke}`,
      ...(p1Respawning && {
        animation: 'respawn-blink 166ms ease-in-out infinite',
      }),
    };
  }
  if (isP2) {
    return {
      backgroundColor: PLAYER_COLORS.p2.primary,
      boxShadow: `0 0 0 1px ${PLAYER_COLORS.p2.stroke}`,
      ...(p2Respawning && {
        animation: 'respawn-blink 166ms ease-in-out infinite',
      }),
    };
  }
  return undefined;
}

function getCellTitle(
  x: number,
  y: number,
  isP1: boolean,
  isP2: boolean,
  isFruit: boolean,
  p1Respawning: boolean,
  p2Respawning: boolean,
): string {
  if (isFruit) return `果实 (${x},${y})`;
  if (isP1) return `P1 蛇身 (${x},${y})${p1Respawning ? ' (重生中)' : ''}`;
  if (isP2) return `P2 蛇身 (${x},${y})${p2Respawning ? ' (重生中)' : ''}`;
  return `空白 (${x},${y})`;
}

export default GameBoard;
