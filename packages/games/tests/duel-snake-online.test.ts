import { describe, expect, it } from 'vitest';
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
  });
});
