import { describe, expect, it } from 'vitest';

import { createLinkedRealtimeEndpoints, type RealtimeEnvelope } from '../src/realtime.js';

interface Ping { type: 'ping'; count: number }

function stripTimestamps<T>(messages: RealtimeEnvelope<T>[]) {
  return messages.map((message) => ({ ...message, createdAt: 0 }));
}

describe('RealtimeEndpoint', () => {
  it('relays payloads with sender metadata between peers', () => {
    const pair = createLinkedRealtimeEndpoints<Ping>();
    const received: RealtimeEnvelope<Ping>[] = [];

    const unsubscribe = pair.guest.subscribe((envelope) => received.push(envelope));
    pair.host.send({ type: 'ping', count: 1 });
    unsubscribe();

    expect(stripTimestamps(received)).toEqual([
      { from: 'host', payload: { type: 'ping', count: 1 }, createdAt: 0 }
    ]);
  });

  it('supports bidirectional delivery and listener cleanup', () => {
    const pair = createLinkedRealtimeEndpoints<Ping>();
    const hostReceived: RealtimeEnvelope<Ping>[] = [];
    const guestReceived: RealtimeEnvelope<Ping>[] = [];

    const offHost = pair.host.subscribe((envelope) => hostReceived.push(envelope));
    const offGuest = pair.guest.subscribe((envelope) => guestReceived.push(envelope));

    pair.host.send({ type: 'ping', count: 2 });
    pair.guest.send({ type: 'ping', count: 3 });

    offHost();
    offGuest();

    pair.host.send({ type: 'ping', count: 4 });
    pair.guest.send({ type: 'ping', count: 5 });

    expect(stripTimestamps(hostReceived)).toEqual([
      { from: 'guest', payload: { type: 'ping', count: 3 }, createdAt: 0 }
    ]);
    expect(stripTimestamps(guestReceived)).toEqual([
      { from: 'host', payload: { type: 'ping', count: 2 }, createdAt: 0 }
    ]);
  });
});
