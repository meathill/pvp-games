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

const duelSnakeOnlineSummary: GameSummary = {
  id: 'duel-snake-online',
  title: 'Duel Snake (Online PVP)',
  description: '在线双人贪吃蛇对决：创建房间邀请好友，或加入好友的房间进行对战。',
  tags: ['online', 'pvp', 'snake'],
  shared: createSharedContext({ project: 'pvp-games' }),
};

// 只保留已实现的游戏，在线版本排在前面
const placeholderGames: GameSummary[] = [duelSnakeOnlineSummary, duelSnakeSummary];

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
