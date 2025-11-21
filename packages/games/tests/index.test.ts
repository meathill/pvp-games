import { describe, expect, it } from 'vitest';
import { listAvailableGames } from '../src/index.js';

describe('games package', () => {
  it('lists available games for selection', () => {
    const games = listAvailableGames();

    expect(games).toContain('duel-snake');
    expect(games.length).toBeGreaterThan(0);
  });
});
