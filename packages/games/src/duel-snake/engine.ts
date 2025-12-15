export type PlayerId = 'p1' | 'p2';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'idle' | 'ready' | 'running' | 'finished';

export interface Point {
  x: number;
  y: number;
}

export interface DuelSnakeOptions {
  width?: number;
  height?: number;
  targetScore?: number;
  tickIntervalMs?: number;
  seed?: string;
  random?: () => number;
}

interface PlayerState {
  id: PlayerId;
  direction: Direction;
  pendingDirection: Direction | null;
  segments: Point[];
  score: number;
  alive: boolean;
  ready: boolean;
  respawnTicksRemaining: number;
}

export interface DuelSnakeState {
  status: GameStatus;
  players: Record<PlayerId, PlayerState>;
  fruit: Point;
  targetScore: number;
  winner?: PlayerId;
  tickIntervalMs: number;
  dimensions: { width: number; height: number };
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DEFAULT_WIDTH = 40;
const DEFAULT_HEIGHT = 30;
const DEFAULT_TARGET_SCORE = 10;
const DEFAULT_TICK_MS = 120;

class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = SeededRandom.hash(seed);
  }

  private static hash(seed: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 0xffffffff;
  }
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

export class DuelSnakeGame {
  private readonly width: number;
  private readonly height: number;
  private readonly targetScore: number;
  private readonly tickIntervalMs: number;
  private readonly random: () => number;

  private status: GameStatus = 'idle';
  private winner: PlayerId | undefined;
  private players: Record<PlayerId, PlayerState>;
  private fruit: Point;

  constructor(options: DuelSnakeOptions = {}) {
    this.width = options.width ?? DEFAULT_WIDTH;
    this.height = options.height ?? DEFAULT_HEIGHT;
    this.targetScore = options.targetScore ?? DEFAULT_TARGET_SCORE;
    this.tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_MS;

    const seeded = new SeededRandom(options.seed ?? 'duel-snake');
    this.random = options.random ?? seeded.next.bind(seeded);

    this.players = {
      p1: this.createPlayer('p1', 'right'),
      p2: this.createPlayer('p2', 'left'),
    };

    this.players.p1.segments = this.buildCornerSegments('p1');
    this.players.p2.segments = this.buildCornerSegments('p2');

    this.fruit = this.spawnFruit();
  }

  getState(): DuelSnakeState {
    return {
      status: this.status,
      fruit: clonePoint(this.fruit),
      targetScore: this.targetScore,
      winner: this.winner,
      tickIntervalMs: this.tickIntervalMs,
      dimensions: { width: this.width, height: this.height },
      players: {
        p1: this.clonePlayer(this.players.p1),
        p2: this.clonePlayer(this.players.p2),
      },
    };
  }

  ready(player: PlayerId): void {
    if (this.status === 'finished') return;
    this.players[player].ready = true;
    if (this.players.p1.ready && this.players.p2.ready) {
      this.status = 'ready';
    }
  }

  start(): void {
    if (this.status === 'ready') {
      this.status = 'running';
    }
  }

  queueInput(player: PlayerId, direction: Direction): void {
    const current = this.players[player];
    // 冷却期内忽略输入
    if (current.respawnTicksRemaining > 0) return;
    if (OPPOSITE[current.direction] === direction) return;
    current.pendingDirection = direction;
  }

  tick(): DuelSnakeState {
    if (this.status !== 'running') {
      return this.getState();
    }

    if (this.winner) {
      this.status = 'finished';
      return this.getState();
    }

    const occupied = this.collectOccupied();
    const plannedMoves: Record<PlayerId, { next: Point; grow: boolean; collide: boolean }> = {
      p1: { next: { x: 0, y: 0 }, grow: false, collide: false },
      p2: { next: { x: 0, y: 0 }, grow: false, collide: false },
    };

    (['p1', 'p2'] as PlayerId[]).forEach((id) => {
      const player = this.players[id];

      // 处理重生冷却期：只有 > 0 时才跳过移动
      if (player.respawnTicksRemaining > 0) {
        player.respawnTicksRemaining -= 1;
        // 冷却期内标记为不碰撞（因为不移动，不会真的碰撞）
        // 但需要一个标记表示"正在冷却中，不要判定为碰撞重生"
        plannedMoves[id].collide = false;
        // 使用特殊标记：通过设置 next 为当前位置来表示不移动
        plannedMoves[id].next = player.segments[0];
        return;
      }

      if (!player.alive) {
        plannedMoves[id].collide = true;
        return;
      }

      if (player.pendingDirection && OPPOSITE[player.direction] !== player.pendingDirection) {
        player.direction = player.pendingDirection;
      }
      player.pendingDirection = null;

      const delta = this.directionDelta(player.direction);
      const nextHead = { x: player.segments[0].x + delta.x, y: player.segments[0].y + delta.y };
      const hitWall = nextHead.x < 0 || nextHead.x >= this.width || nextHead.y < 0 || nextHead.y >= this.height;
      const hitBody = occupied.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);

      plannedMoves[id] = {
        next: nextHead,
        grow: nextHead.x === this.fruit.x && nextHead.y === this.fruit.y,
        collide: hitWall || hitBody,
      };
    });

    (['p1', 'p2'] as PlayerId[]).forEach((id) => {
      const plan = plannedMoves[id];
      const player = this.players[id];

      // 如果蛇头位置没变（冷却期内），跳过处理
      if (plan.next.x === player.segments[0].x && plan.next.y === player.segments[0].y && !plan.collide) {
        return;
      }

      if (plan.collide) {
        // 只有真正碰撞时才重生
        this.respawnPlayer(id);
        return;
      }

      player.segments.unshift(plan.next);
      if (!plan.grow) {
        player.segments.pop();
      } else {
        player.score += 1;
        this.fruit = this.spawnFruit();
        if (player.score >= this.targetScore) {
          this.winner = id;
          this.status = 'finished';
        }
      }
    });

    return this.getState();
  }

  setFruitForTest(point: Point): void {
    const blocked = this.collectOccupied();
    const overlaps = blocked.some((cell) => cell.x === point.x && cell.y === point.y);
    this.fruit = overlaps ? this.spawnFruit() : clonePoint(point);
  }

  private createPlayer(id: PlayerId, direction: Direction): PlayerState {
    return {
      id,
      direction,
      pendingDirection: null,
      segments: [],
      score: 0,
      alive: true,
      ready: false,
      respawnTicksRemaining: 0,
    };
  }

  private buildCornerSegments(player: PlayerId): Point[] {
    const y = player === 'p1' ? 1 : this.height - 2;
    if (player === 'p2') {
      const x = this.width - 3;
      return [
        { x, y },
        { x: x + 1, y },
        { x: x + 2, y },
      ];
    }
    return [
      { x: 2, y },
      { x: 1, y },
      { x: 0, y },
    ];
  }

  private collectOccupied(): Point[] {
    return [...this.players.p1.segments, ...this.players.p2.segments];
  }

  private spawnFruit(): Point {
    const occupied = this.collectOccupied();
    const available: Point[] = [];
    for (let x = 0; x < this.width; x += 1) {
      for (let y = 0; y < this.height; y += 1) {
        if (!occupied.some((cell) => cell.x === x && cell.y === y)) {
          available.push({ x, y });
        }
      }
    }
    if (available.length === 0) {
      return { x: 0, y: 0 };
    }
    const index = Math.floor(this.random() * available.length) % available.length;
    return available[index];
  }

  private respawnPlayer(player: PlayerId): void {
    const otherOccupied = this.collectOccupied().filter(
      (cell) => !this.players[player].segments.some((segment) => segment.x === cell.x && segment.y === cell.y),
    );
    const occupiedSet = new Set(otherOccupied.map((cell) => `${cell.x},${cell.y}`));

    // 收集所有可用的重生位置（离墙至少3格，不与蛇身重叠，且前方可移动）
    const candidates: Array<{ x: number; y: number; direction: Direction }> = [];
    const directions: Direction[] = ['up', 'down', 'left', 'right'];

    for (let x = 3; x < this.width - 3; x += 1) {
      for (let y = 3; y < this.height - 3; y += 1) {
        // 尝试每个方向
        for (const direction of directions) {
          const segments = this.buildRespawnSegments(x, y, direction);
          const isSafe = segments.every((seg) => !occupiedSet.has(`${seg.x},${seg.y}`));
          if (!isSafe) continue;

          // 检查蛇头前方的下一步是否也安全（不会立刻碰撞）
          const delta = this.directionDelta(direction);
          const nextHead = { x: segments[0].x + delta.x, y: segments[0].y + delta.y };
          const nextSafe = !occupiedSet.has(`${nextHead.x},${nextHead.y}`) &&
            nextHead.x >= 0 && nextHead.x < this.width &&
            nextHead.y >= 0 && nextHead.y < this.height;

          if (nextSafe) {
            candidates.push({ x, y, direction });
          }
        }
      }
    }

    // 如果没有找到安全位置，回退到四角（不检查前方，作为最后手段）
    if (candidates.length === 0) {
      const corners: Array<{ x: number; y: number; direction: Direction }> = [
        { x: 2, y: 2, direction: 'right' },
        { x: this.width - 3, y: 2, direction: 'left' },
        { x: 2, y: this.height - 3, direction: 'right' },
        { x: this.width - 3, y: this.height - 3, direction: 'left' },
      ];
      for (const corner of corners) {
        const segments = this.buildRespawnSegments(corner.x, corner.y, corner.direction);
        const isSafe = segments.every((seg) => !occupiedSet.has(`${seg.x},${seg.y}`));
        if (isSafe) {
          candidates.push(corner);
        }
      }
    }

    // 如果仍然没有，强制使用第一个角落
    const fallback = { x: 2, y: 2, direction: 'right' as Direction };
    const chosen = candidates.length > 0
      ? candidates[Math.floor(this.random() * candidates.length) % candidates.length]
      : fallback;

    const segments = this.buildRespawnSegments(chosen.x, chosen.y, chosen.direction);

    this.players[player].segments = segments;
    this.players[player].direction = chosen.direction;
    this.players[player].pendingDirection = null;
    this.players[player].alive = true;
    this.players[player].score = 0; // 死亡时重置分数
    this.players[player].respawnTicksRemaining = 3; // 3帧冷却期（闪烁3次）
  }

  private buildRespawnSegments(x: number, y: number, direction: Direction): Point[] {
    switch (direction) {
      case 'right':
        return [
          { x, y },
          { x: x - 1, y },
          { x: x - 2, y },
        ];
      case 'left':
        return [
          { x, y },
          { x: x + 1, y },
          { x: x + 2, y },
        ];
      case 'up':
        return [
          { x, y },
          { x, y: y + 1 },
          { x, y: y + 2 },
        ];
      case 'down':
        return [
          { x, y },
          { x, y: y - 1 },
          { x, y: y - 2 },
        ];
      default:
        return [
          { x, y },
          { x: x - 1, y },
          { x: x - 2, y },
        ];
    }
  }

  private clonePlayer(player: PlayerState): PlayerState {
    return {
      ...player,
      segments: player.segments.map(clonePoint),
    };
  }

  private directionDelta(direction: Direction): Point {
    switch (direction) {
      case 'up':
        return { x: 0, y: -1 };
      case 'down':
        return { x: 0, y: 1 };
      case 'left':
        return { x: -1, y: 0 };
      case 'right':
      default:
        return { x: 1, y: 0 };
    }
  }
}
