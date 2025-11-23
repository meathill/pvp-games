import type { PeerRole, RealtimeEndpoint, RealtimeEnvelope } from '@pvp-games/shared';

import type { Direction, DuelSnakeOptions, DuelSnakeState } from './engine';
import { DuelSnakeGame } from './engine';

/** Wire protocol version for compatibility checking */
export const WIRE_PROTOCOL_VERSION = 1;

export type DuelSnakeWireMessage =
  | { type: 'ready' }
  | { type: 'input'; direction: Direction; clientTick: number }
  | { type: 'state'; state: DuelSnakeState; tick: number; serverTime: number }
  | { type: 'sync-request' }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number; serverTime: number };

interface HostOptions extends DuelSnakeOptions {
  channel: RealtimeEndpoint<DuelSnakeWireMessage>;
  /** Called when game state changes */
  onStateChange?: (state: DuelSnakeState) => void;
  /** Called when there's an error */
  onError?: (error: Error) => void;
}

interface ClientOptions {
  channel: RealtimeEndpoint<DuelSnakeWireMessage>;
  /** Called when game state changes */
  onStateChange?: (state: DuelSnakeState) => void;
  /** Called when connection quality changes */
  onLatencyUpdate?: (latencyMs: number) => void;
  /** Called when there's an error */
  onError?: (error: Error) => void;
}

interface ReadyTracker {
  host: boolean;
  guest: boolean;
}

/** Input with timestamp for buffering */
interface TimestampedInput {
  direction: Direction;
  receivedAt: number;
  clientTick: number;
}

export class DuelSnakeOnlineHost {
  private readonly channel: RealtimeEndpoint<DuelSnakeWireMessage>;
  private readonly ready: ReadyTracker = { host: false, guest: false };
  private readonly roleToPlayer: Record<PeerRole, 'p1' | 'p2'> = {
    host: 'p1',
    guest: 'p2'
  };
  private readonly onStateChange?: (state: DuelSnakeState) => void;
  private readonly onError?: (error: Error) => void;

  /** Buffer for guest inputs to handle network jitter */
  private readonly inputBuffer: TimestampedInput[] = [];
  /** Maximum input buffer size */
  private readonly maxInputBuffer = 5;

  private readonly teardown: () => void;
  private game: DuelSnakeGame;
  private state: DuelSnakeState;
  private tickCount = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor({ channel, onStateChange, onError, ...options }: HostOptions) {
    this.channel = channel;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.game = new DuelSnakeGame(options);
    this.state = this.game.getState();
    this.teardown = this.channel.subscribe((envelope) => this.handleMessage(envelope));
  }

  markReady(): void {
    if (this.disposed) return;
    this.ready.host = true;
    this.game.ready(this.roleToPlayer.host);
    this.maybeStartAndSync();
  }

  queueInput(direction: Direction): void {
    if (this.disposed) return;
    this.game.queueInput(this.roleToPlayer.host, direction);
  }

  /**
   * Perform a single tick of the game loop.
   * Call this externally for testing, or use startLoop() for auto-ticking.
   */
  tick(): DuelSnakeState {
    if (this.disposed) return this.state;

    // Process any buffered inputs
    this.processInputBuffer();

    this.state = this.game.tick();
    this.tickCount += 1;
    this.broadcastState();
    this.onStateChange?.(this.state);
    return this.state;
  }

  /**
   * Start the automatic game loop at the configured tick interval.
   */
  startLoop(): void {
    if (this.disposed || this.tickInterval) return;

    this.tickInterval = setInterval(() => {
      if (this.state.status === 'running') {
        this.tick();
      }
    }, this.state.tickIntervalMs);
  }

  /**
   * Stop the automatic game loop.
   */
  stopLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  getState(): DuelSnakeState {
    return this.state;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  isGuestReady(): boolean {
    return this.ready.guest;
  }

  setFruitForTest(point: { x: number; y: number }): void {
    this.game.setFruitForTest(point);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.teardown();
  }

  private handleMessage(envelope: RealtimeEnvelope<DuelSnakeWireMessage>): void {
    if (this.disposed) return;

    try {
      const { payload, from } = envelope;

      switch (payload.type) {
        case 'ready':
          this.ready[from] = true;
          this.game.ready(this.roleToPlayer[from]);
          this.maybeStartAndSync();
          break;

        case 'input':
          // Buffer the input with timestamp
          this.inputBuffer.push({
            direction: payload.direction,
            receivedAt: Date.now(),
            clientTick: payload.clientTick
          });
          // Trim buffer if too large
          while (this.inputBuffer.length > this.maxInputBuffer) {
            this.inputBuffer.shift();
          }
          break;

        case 'sync-request':
          // Client is requesting current state (e.g., after reconnect)
          this.broadcastState();
          break;

        case 'ping':
          // Respond with pong for latency measurement
          this.channel.send({
            type: 'pong',
            timestamp: payload.timestamp,
            serverTime: Date.now()
          });
          break;
      }
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private processInputBuffer(): void {
    // Apply buffered inputs (newest first if multiple for same tick)
    const input = this.inputBuffer.shift();
    if (input) {
      this.game.queueInput(this.roleToPlayer.guest, input.direction);
    }
  }

  private maybeStartAndSync(): void {
    if (this.ready.host && this.ready.guest && this.state.status === 'idle') {
      this.game.start();
      this.state = this.game.getState();
      this.broadcastState();
      this.onStateChange?.(this.state);
    }
  }

  private broadcastState(): void {
    this.channel.send({
      type: 'state',
      state: this.state,
      tick: this.tickCount,
      serverTime: Date.now()
    });
  }
}

export class DuelSnakeOnlineClient {
  private readonly channel: RealtimeEndpoint<DuelSnakeWireMessage>;
  private readonly onStateChange?: (state: DuelSnakeState) => void;
  private readonly onLatencyUpdate?: (latencyMs: number) => void;
  private readonly onError?: (error: Error) => void;

  private readonly teardown: () => void;
  private state: DuelSnakeState | undefined;
  private lastTick = 0;
  private localTickCount = 0;
  private disposed = false;

  /** Estimated latency to host in milliseconds */
  private latencyMs = 0;
  /** Interval for periodic ping */
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor({ channel, onStateChange, onLatencyUpdate, onError }: ClientOptions) {
    this.channel = channel;
    this.onStateChange = onStateChange;
    this.onLatencyUpdate = onLatencyUpdate;
    this.onError = onError;
    this.teardown = this.channel.subscribe((envelope) => this.handleMessage(envelope));
  }

  markReady(): void {
    if (this.disposed) return;
    this.channel.send({ type: 'ready' });
    this.startPingInterval();
  }

  sendInput(direction: Direction): void {
    if (this.disposed) return;
    this.localTickCount += 1;
    this.channel.send({
      type: 'input',
      direction,
      clientTick: this.localTickCount
    });
  }

  /**
   * Request a state sync from the host.
   * Useful after reconnection or if state seems stale.
   */
  requestSync(): void {
    if (this.disposed) return;
    this.channel.send({ type: 'sync-request' });
  }

  getState(): DuelSnakeState | undefined {
    return this.state;
  }

  getLastTick(): number {
    return this.lastTick;
  }

  getLatency(): number {
    return this.latencyMs;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopPingInterval();
    this.teardown();
  }

  private handleMessage(envelope: RealtimeEnvelope<DuelSnakeWireMessage>): void {
    if (this.disposed) return;

    try {
      const { payload } = envelope;

      switch (payload.type) {
        case 'state':
          // Only apply if this is a newer state
          if (payload.tick >= this.lastTick) {
            this.state = payload.state;
            this.lastTick = payload.tick;
            this.onStateChange?.(this.state);
          }
          break;

        case 'pong':
          // Calculate round-trip latency
          const rtt = Date.now() - payload.timestamp;
          this.latencyMs = rtt / 2;
          this.onLatencyUpdate?.(this.latencyMs);
          break;
      }
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private startPingInterval(): void {
    // Ping every 2 seconds to measure latency
    this.pingInterval = setInterval(() => {
      if (!this.disposed) {
        this.channel.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 2000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
