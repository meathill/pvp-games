import { describe, expect, it } from 'vitest';

import { MockSignalingChannel, MESSAGE_VERSION, type VersionedMessage } from '../src';

describe('MockSignalingChannel', () => {
  it('relays messages between linked channels', async () => {
    const channel1 = new MockSignalingChannel();
    const channel2 = new MockSignalingChannel();

    channel1.linkTo(channel2);
    channel2.linkTo(channel1);

    const received: unknown[] = [];
    channel2.onMessage((msg) => received.push(msg));

    channel1.send({ type: 'offer', sdp: 'test-sdp' });

    // Wait for async delivery
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]).toEqual({ type: 'offer', sdp: 'test-sdp' });
  });

  it('supports multiple listeners', async () => {
    const channel1 = new MockSignalingChannel();
    const channel2 = new MockSignalingChannel();

    channel1.linkTo(channel2);
    channel2.linkTo(channel1);

    const received1: unknown[] = [];
    const received2: unknown[] = [];

    channel2.onMessage((msg) => received1.push(msg));
    channel2.onMessage((msg) => received2.push(msg));

    channel1.send({ type: 'answer', sdp: 'answer-sdp' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
  });

  it('allows unsubscribing listeners', async () => {
    const channel1 = new MockSignalingChannel();
    const channel2 = new MockSignalingChannel();

    channel1.linkTo(channel2);
    channel2.linkTo(channel1);

    const received: unknown[] = [];
    const unsubscribe = channel2.onMessage((msg) => received.push(msg));

    channel1.send({ type: 'ready' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    unsubscribe();

    channel1.send({ type: 'ready' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
  });
});

describe('MESSAGE_VERSION', () => {
  it('is a positive integer', () => {
    expect(MESSAGE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(MESSAGE_VERSION)).toBe(true);
  });
});

describe('VersionedMessage format', () => {
  it('can be serialized and deserialized', () => {
    const message: VersionedMessage<{ type: string; value: number }> = {
      v: MESSAGE_VERSION,
      envelope: {
        from: 'host',
        payload: { type: 'test', value: 123 },
        createdAt: Date.now(),
      },
    };

    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized) as typeof message;

    expect(deserialized.v).toBe(MESSAGE_VERSION);
    expect(deserialized.envelope.from).toBe('host');
    expect(deserialized.envelope.payload.value).toBe(123);
  });
});
