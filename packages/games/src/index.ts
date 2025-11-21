import { createSharedContext } from '@pvp-games/shared';
import type { SharedContext } from '@pvp-games/shared';
import { DuelSnakeGame } from './duel-snake';

export interface GameSummary {
  id: string;
  title: string;
  shared: SharedContext;
  description?: string;
  tags?: string[];
}

const duelSnakeSummary: GameSummary = {
  id: 'duel-snake',
  title: 'Duel Snake (Local 2P)',
  description: '双人同屏贪吃蛇对决：1P 方向键，2P WASD，先吃 10 果获胜。',
  tags: ['local', '2p', 'snake'],
  shared: createSharedContext({ project: 'pvp-games' })
};

const placeholderGames: GameSummary[] = [duelSnakeSummary];

export function listAvailableGames(): string[] {
  return placeholderGames.map((game) => game.id);
}

export function getGameSummaries(): GameSummary[] {
  return [...placeholderGames];
}

export { DuelSnakeGame } from './duel-snake';
export type { Direction, DuelSnakeState, GameStatus, PlayerId } from './duel-snake';
