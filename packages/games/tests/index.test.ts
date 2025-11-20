import { describe, expect, it } from 'vitest';
import { listAvailableGames } from '../src/index.js';

describe('games package', () => {
  it('lists placeholder games to seed future development', () => {
    const games = listAvailableGames();

    expect(games).toContain('duel-snake');
    expect(games).toContain('battle-tanks');
  });
});
