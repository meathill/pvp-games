import type { PeerRole, RealtimeEndpoint, RealtimeEnvelope } from '@pvp-games/shared';

import type { Direction, DuelSnakeOptions, DuelSnakeState } from './engine';
import { DuelSnakeGame } from './engine';

export type DuelSnakeWireMessage =
  | { type: 'ready' }
  | { type: 'input'; direction: Direction }
  | { type: 'state'; state: DuelSnakeState; tick: number };

interface HostOptions extends DuelSnakeOptions {
  channel: RealtimeEndpoint<DuelSnakeWireMessage>;
}

interface ClientOptions {
  channel: RealtimeEndpoint<DuelSnakeWireMessage>;
}

interface ReadyTracker {
  host: boolean;
  guest: boolean;
}

export class DuelSnakeOnlineHost {
  private readonly channel: RealtimeEndpoint<DuelSnakeWireMessage>;
  private readonly ready: ReadyTracker = { host: false, guest: false };
  private readonly roleToPlayer: Record<PeerRole, 'p1' | 'p2'> = {
    host: 'p1',
    guest: 'p2'
  };

  private readonly teardown: () => void;
  private game: DuelSnakeGame;
  private state: DuelSnakeState;
  private tickCount = 0;

  constructor({ channel, ...options }: HostOptions) {
    this.channel = channel;
    this.game = new DuelSnakeGame(options);
    this.state = this.game.getState();
    this.teardown = this.channel.subscribe((envelope) => this.handleMessage(envelope));
  }

  markReady(): void {
    this.ready.host = true;
    this.game.ready(this.roleToPlayer.host);
    this.maybeStartAndSync();
  }

  queueInput(direction: Direction): void {
    this.game.queueInput(this.roleToPlayer.host, direction);
  }

  tick(): DuelSnakeState {
    this.state = this.game.tick();
    this.tickCount += 1;
    this.broadcastState();
    return this.state;
  }

  getState(): DuelSnakeState {
    return this.state;
  }

  setFruitForTest(point: { x: number; y: number }): void {
    this.game.setFruitForTest(point);
  }

  dispose(): void {
    this.teardown();
  }

  private handleMessage(envelope: RealtimeEnvelope<DuelSnakeWireMessage>): void {
    const { payload, from } = envelope;
    if (payload.type === 'ready') {
      this.ready[from] = true;
      this.game.ready(this.roleToPlayer[from]);
      this.maybeStartAndSync();
      return;
    }

    if (payload.type === 'input') {
      this.game.queueInput(this.roleToPlayer[from], payload.direction);
    }
  }

  private maybeStartAndSync(): void {
    if (this.ready.host && this.ready.guest && this.state.status === 'idle') {
      this.game.start();
      this.state = this.game.getState();
      this.broadcastState();
    }
  }

  private broadcastState(): void {
    this.channel.send({ type: 'state', state: this.state, tick: this.tickCount });
  }
}

export class DuelSnakeOnlineClient {
  private readonly channel: RealtimeEndpoint<DuelSnakeWireMessage>;
  private readonly teardown: () => void;
  private state: DuelSnakeState | undefined;

  constructor({ channel }: ClientOptions) {
    this.channel = channel;
    this.teardown = this.channel.subscribe((envelope) => this.handleMessage(envelope));
  }

  markReady(): void {
    this.channel.send({ type: 'ready' });
  }

  sendInput(direction: Direction): void {
    this.channel.send({ type: 'input', direction });
  }

  getState(): DuelSnakeState | undefined {
    return this.state;
  }

  dispose(): void {
    this.teardown();
  }

  private handleMessage(envelope: RealtimeEnvelope<DuelSnakeWireMessage>): void {
    const { payload } = envelope;
    if (payload.type === 'state') {
      this.state = payload.state;
    }
  }
}
