import { createSharedContext } from '@pvp-games/shared';
import type { SharedContext } from '@pvp-games/shared';
import { DuelSnakeGame } from './duel-snake/engine';

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
  shared: createSharedContext({ project: 'pvp-games' }),
};

const skyPongSummary: GameSummary = {
  id: 'sky-pong',
  title: 'Sky Pong (Online soon)',
  description: '云端对战的空战乒乓，计划支持匹配与观战。',
  tags: ['online', 'ranked'],
  shared: createSharedContext({ project: 'pvp-games' }),
};

const gridRushSummary: GameSummary = {
  id: 'grid-rush',
  title: 'Grid Rush (Co-op)',
  description: '合作解锁格子的街机闯关，适合直播互动与局域网。',
  tags: ['co-op', 'arcade'],
  shared: createSharedContext({ project: 'pvp-games' }),
};

const placeholderGames: GameSummary[] = [duelSnakeSummary, skyPongSummary, gridRushSummary];

export function listAvailableGames(): string[] {
  return placeholderGames.map((game) => game.id);
}

export function getGameSummaries(): GameSummary[] {
  return [...placeholderGames];
}

export { DuelSnakeGame };
export { DuelSnakeExperience } from './duel-snake/react';
export { DuelSnakeOnline } from './duel-snake/online-react';
export { DuelSnakeOnlineClient, DuelSnakeOnlineHost, type DuelSnakeWireMessage } from './duel-snake/online';
export type { Direction, DuelSnakeState, PlayerId } from './duel-snake/engine';
