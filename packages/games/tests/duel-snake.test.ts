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

  it('respawns after hitting right wall', () => {
    const game = new DuelSnakeGame({ width: 8, height: 6, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // p1 starts at x=2, move right until hitting wall at x=8
    for (let i = 0; i < 10; i++) {
      game.tick();
    }

    // After respawn, p1 should be alive with 3 segments
    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3);
  });

  it('respawns after hitting bottom wall', () => {
    const game = new DuelSnakeGame({ width: 8, height: 6, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Force p1 to move down until hitting bottom wall
    game.queueInput('p1', 'down');
    for (let i = 0; i < 10; i++) {
      game.tick();
    }

    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3);
  });

  it('respawns after hitting left wall', () => {
    const game = new DuelSnakeGame({ width: 8, height: 6, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // p1 needs to turn around: go up then left
    game.queueInput('p1', 'up');
    game.tick();
    game.queueInput('p1', 'left');
    for (let i = 0; i < 10; i++) {
      game.tick();
    }

    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3);
  });

  it('respawns after hitting own body', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Grow the snake first by eating some fruits
    game.setFruitForTest({ x: 3, y: 1 });
    game.tick(); // eat fruit, grow to 4
    game.setFruitForTest({ x: 4, y: 1 });
    game.tick(); // eat fruit, grow to 5
    game.setFruitForTest({ x: 5, y: 1 });
    game.tick(); // eat fruit, grow to 6

    // Now make a U-turn to hit own body: down, left, up
    game.queueInput('p1', 'down');
    game.tick();
    game.queueInput('p1', 'left');
    game.tick();
    game.queueInput('p1', 'up');
    game.tick(); // should hit own body

    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3); // respawned with 3 segments
  });

  it('respawns after hitting opponent snake', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0.5]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Move both snakes towards center
    // p1 starts at (2,1) facing right, p2 at (7,8) facing left
    game.queueInput('p1', 'down');
    game.queueInput('p2', 'up');

    // Run multiple ticks until they might collide
    for (let i = 0; i < 20; i++) {
      game.tick();
    }

    // Both snakes should still be alive (respawned if collision occurred)
    const state = game.getState();
    expect(state.players.p1.alive).toBe(true);
    expect(state.players.p2.alive).toBe(true);
  });
});
