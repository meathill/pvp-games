import { describe, expect, it, vi } from 'vitest';
import { createLinkedRealtimeEndpoints } from '@pvp-games/shared';

import { DuelSnakeOnlineClient, DuelSnakeOnlineHost, type DuelSnakeWireMessage } from '../src/duel-snake/online.js';

describe('DuelSnake online mode', () => {
  it('starts running after both peers mark ready', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, seed: 'net-seed', tickIntervalMs: 80 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    expect(client.getState()).toBeUndefined();

    host.markReady();
    client.markReady();

    host.tick();

    const clientState = client.getState();
    expect(clientState?.status).toBe('running');
    expect(clientState?.dimensions.width).toBeGreaterThan(0);
    expect(clientState?.tickIntervalMs).toBe(80);

    host.dispose();
    client.dispose();
  });

  it('broadcasts state after applying guest inputs on host', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, width: 10, height: 8, seed: 'net-p2', tickIntervalMs: 100 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    host.markReady();
    client.markReady();

    host.setFruitForTest({ x: 6, y: 6 });
    client.sendInput('left');
    host.tick();

    const clientState = client.getState();
    expect(clientState?.players.p2.score).toBe(1);
    expect(clientState?.winner).toBeUndefined();
    expect(clientState?.status).toBe('running');

    host.dispose();
    client.dispose();
  });

  it('tracks tick count on host and last tick on client', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, seed: 'tick-test', tickIntervalMs: 100 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    host.markReady();
    client.markReady();

    expect(host.getTickCount()).toBe(0);
    expect(client.getLastTick()).toBe(0);

    host.tick();
    expect(host.getTickCount()).toBe(1);
    expect(client.getLastTick()).toBe(1);

    host.tick();
    host.tick();
    expect(host.getTickCount()).toBe(3);
    expect(client.getLastTick()).toBe(3);

    host.dispose();
    client.dispose();
  });

  it('calls onStateChange callback on state updates', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const hostStateChanges: unknown[] = [];
    const clientStateChanges: unknown[] = [];

    const host = new DuelSnakeOnlineHost({
      channel: link.host,
      seed: 'callback-test',
      tickIntervalMs: 100,
      onStateChange: (state) => hostStateChanges.push(state.status)
    });
    const client = new DuelSnakeOnlineClient({
      channel: link.guest,
      onStateChange: (state) => clientStateChanges.push(state.status)
    });

    host.markReady();
    client.markReady();

    // Should have received 'running' status after both ready
    expect(hostStateChanges).toContain('running');
    expect(clientStateChanges).toContain('running');

    host.dispose();
    client.dispose();
  });

  it('client can request state sync from host', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, seed: 'sync-test', tickIntervalMs: 100 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    host.markReady();
    client.markReady();
    host.tick();

    // Store the tick count before sync
    const tickBefore = client.getLastTick();
    expect(tickBefore).toBe(1);

    // Request sync should trigger a new state broadcast
    client.requestSync();

    // State should still be defined after sync request
    const syncedState = client.getState();
    expect(syncedState).toBeDefined();
    expect(syncedState?.status).toBe('running');

    host.dispose();
    client.dispose();
  });

  it('isGuestReady returns correct value', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, seed: 'ready-test', tickIntervalMs: 100 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    expect(host.isGuestReady()).toBe(false);

    host.markReady();
    expect(host.isGuestReady()).toBe(false);

    client.markReady();
    expect(host.isGuestReady()).toBe(true);

    host.dispose();
    client.dispose();
  });

  it('buffers multiple inputs correctly', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, width: 10, height: 8, seed: 'buffer-test', tickIntervalMs: 100 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    host.markReady();
    client.markReady();

    // Send multiple inputs before tick
    client.sendInput('up');
    client.sendInput('left');
    client.sendInput('down');

    // Only the first should be processed on first tick (FIFO)
    host.tick();
    
    // Subsequent ticks should process remaining buffered inputs
    host.tick();
    host.tick();

    // Game should still be running
    expect(client.getState()?.status).toBe('running');

    host.dispose();
    client.dispose();
  });

  it('handles dispose gracefully', () => {
    const link = createLinkedRealtimeEndpoints<DuelSnakeWireMessage>();
    const host = new DuelSnakeOnlineHost({ channel: link.host, seed: 'dispose-test', tickIntervalMs: 100 });
    const client = new DuelSnakeOnlineClient({ channel: link.guest });

    host.markReady();
    client.markReady();
    host.tick();

    // Dispose both
    host.dispose();
    client.dispose();

    // Operations after dispose should not throw
    expect(() => {
      host.markReady();
      host.tick();
      host.queueInput('up');
      client.markReady();
      client.sendInput('down');
    }).not.toThrow();
  });
});
