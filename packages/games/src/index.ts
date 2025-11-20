import { createSharedContext, SharedContext } from '@pvp-games/shared';

export interface GameSummary {
  id: string;
  title: string;
  shared: SharedContext;
}

const placeholderGames: GameSummary[] = [
  {
    id: 'duel-snake',
    title: 'Duel Snake',
    shared: createSharedContext({ project: 'pvp-games' })
  },
  {
    id: 'battle-tanks',
    title: 'Battle Tanks',
    shared: createSharedContext({ project: 'pvp-games' })
  }
];

export function listAvailableGames(): string[] {
  return placeholderGames.map((game) => game.id);
}

export function getGameSummaries(): GameSummary[] {
  return [...placeholderGames];
}
