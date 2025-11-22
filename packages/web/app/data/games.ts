import { getGameSummaries } from '@pvp-games/games';
import { createSharedContext } from '@pvp-games/shared';
import type { GameSummary } from '@pvp-games/games';

export interface GameEntry extends GameSummary {
  slug: string;
}

const fallbackCatalog: GameEntry[] = [
  {
    id: 'duel-snake',
    slug: 'duel-snake',
    title: 'Duel Snake (Local 2P)',
    description: '本地双人同屏贪吃蛇对决：1P 方向键，2P WASD，先吃 10 果获胜。',
    tags: ['local', '2p', 'snake'],
    shared: createSharedContext({ project: 'pvp-games' })
  }
];

let catalog: GameEntry[] | undefined;

function loadCatalog(): GameEntry[] {
  if (catalog) return catalog;

  try {
    catalog = getGameSummaries().map((game) => ({
      ...game,
      slug: game.id
    }));
  } catch (error) {
    console.warn('Failed to load game summaries from @pvp-games/games, using fallback catalog', error);
    catalog = fallbackCatalog;
  }

  return catalog;
}

export function listGameCatalog(): GameEntry[] {
  return loadCatalog();
}

export function findGameBySlug(slug: string): GameEntry | undefined {
  return loadCatalog().find((game) => game.slug === slug);
}
