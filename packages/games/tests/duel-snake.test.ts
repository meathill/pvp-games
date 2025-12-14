import { describe, expect, it } from 'vitest';
import { DuelSnakeGame, type Direction } from '../src/duel-snake';

const sequenceRandom = (values: number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
};

describe('DuelSnakeGame (local 2P)', () => {
  it('requires both players ready before running', () => {
    const game = new DuelSnakeGame({ random: sequenceRandom([0.25]) });

    expect(game.getState().status).toBe('idle');
    game.ready('p1');
    expect(game.getState().status).toBe('idle');
    game.ready('p2');
    expect(game.getState().status).toBe('ready');

    game.start();
    expect(game.getState().status).toBe('running');
  });

  it('grows on fruit, rejects opposite inputs, and declares winner at target score', () => {
    const game = new DuelSnakeGame({ width: 8, height: 6, targetScore: 2 });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Place fruit directly in front of p1 and try to reverse direction (ignored).
    game.setFruitForTest({ x: 3, y: 1 });
    game.queueInput('p1', 'left');
    game.queueInput('p1', 'right');
    game.tick();

    let state = game.getState();
    expect(state.players.p1.score).toBe(1);
    expect(state.players.p1.segments.length).toBe(4);
    expect(state.players.p1.segments[0]).toEqual({ x: 3, y: 1 });

    // Keep moving right to the next fruit and end the match.
    game.setFruitForTest({ x: 4, y: 1 });
    game.tick();

    state = game.getState();
    expect(state.status).toBe('finished');
    expect(state.winner).toBe('p1');
    expect(state.players.p1.score).toBe(2);
  });

  it('respawns with 3 cells in a random corner after wall collision', () => {
    const game = new DuelSnakeGame({ width: 8, height: 6, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Force p1 to crash into the top wall.
    game.queueInput('p1', 'up');
    game.tick(); // move to y=0
    game.tick(); // move to y=-1 -> death and respawn

    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments).toEqual([
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
  });
});
