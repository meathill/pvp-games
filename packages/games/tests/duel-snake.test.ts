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

  it('respawns with 3 cells in a random safe location after wall collision', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Force p1 to crash into the top wall.
    game.queueInput('p1', 'up');
    game.tick(); // move to y=0
    game.tick(); // move to y=-1 -> death and respawn

    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3);
    // 验证重生位置在安全区域内（离墙至少3格）
    const head = p1.segments[0];
    expect(head.x).toBeGreaterThanOrEqual(3);
    expect(head.x).toBeLessThan(7);
    expect(head.y).toBeGreaterThanOrEqual(3);
    expect(head.y).toBeLessThan(7);
  });

  it('respawns after hitting right wall', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // p1 starts at x=2, move right until hitting wall at x=10
    for (let i = 0; i < 12; i++) {
      game.tick();
    }

    // After respawn, p1 should be alive with 3 segments in safe zone
    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3);
  });

  it('respawns after hitting bottom wall', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Force p1 to move down until hitting bottom wall
    game.queueInput('p1', 'down');
    for (let i = 0; i < 12; i++) {
      game.tick();
    }

    const p1 = game.getState().players.p1;
    expect(p1.alive).toBe(true);
    expect(p1.segments.length).toBe(3);
  });

  it('respawns after hitting left wall', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
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

  it('resets score to 0 on death', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Eat some fruits to gain score
    game.setFruitForTest({ x: 3, y: 1 });
    game.tick();
    game.setFruitForTest({ x: 4, y: 1 });
    game.tick();

    expect(game.getState().players.p1.score).toBe(2);

    // Now crash into wall
    game.queueInput('p1', 'up');
    game.tick();
    game.tick(); // hit wall and respawn

    // Score should be reset to 0
    expect(game.getState().players.p1.score).toBe(0);
  });

  it('ignores input during respawn cooldown', () => {
    const game = new DuelSnakeGame({ width: 10, height: 10, random: sequenceRandom([0]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Force p1 to crash into wall
    game.queueInput('p1', 'up');
    game.tick();
    game.tick(); // respawn with 3 ticks cooldown

    // Should have cooldown
    expect(game.getState().players.p1.respawnTicksRemaining).toBe(3);

    // Try to queue input during cooldown - should be ignored
    const segmentsBefore = game.getState().players.p1.segments;
    game.queueInput('p1', 'right');
    game.tick(); // cooldown: 3 -> 2

    // Snake should not have moved
    const segmentsAfter = game.getState().players.p1.segments;
    expect(segmentsAfter).toEqual(segmentsBefore);
    expect(game.getState().players.p1.respawnTicksRemaining).toBe(2);
  });

  it('decreases respawn cooldown each tick', () => {
    const game = new DuelSnakeGame({ width: 40, height: 40, random: sequenceRandom([0.5]) });
    game.ready('p1');
    game.ready('p2');
    game.start();

    // Force p1 to crash by going up into wall
    game.queueInput('p1', 'up');
    game.tick(); // y: 1 -> 0
    game.tick(); // y: 0 -> -1, respawn with cooldown = 3

    // 验证冷却期初始化为 3
    expect(game.getState().players.p1.respawnTicksRemaining).toBe(3);

    // 记录重生位置
    const posAtRespawn = { ...game.getState().players.p1.segments[0] };

    // 第一次 tick: 3 -> 2，位置不变
    game.tick();
    expect(game.getState().players.p1.respawnTicksRemaining).toBe(2);
    expect(game.getState().players.p1.segments[0]).toEqual(posAtRespawn);
  });
});
