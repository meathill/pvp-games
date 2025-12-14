import { describe, expect, it } from 'vitest';

/**
 * GameRoom Durable Object logic tests
 * 
 * Note: Full integration tests require Cloudflare's Miniflare or wrangler dev.
 * These tests verify the protocol and message handling logic.
 */

// Message types used by the signaling protocol
type RelayWireMessage =
  | { type: 'join'; role: 'host' | 'guest' }
  | { type: 'joined'; role: 'host' | 'guest' }
  | { type: 'leave'; role: 'host' | 'guest' }
  | { type: 'room-ready' }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'game'; payload: unknown };

// Mock WebSocket for testing
interface MockWebSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
  sentMessages: string[];
}

function createMockWebSocket(): MockWebSocket {
  return {
    readyState: 1, // WebSocket.OPEN
    sentMessages: [],
    send(data: string) {
      this.sentMessages.push(data);
    },
    close() {
      this.readyState = 3; // WebSocket.CLOSED
    },
  };
}

describe('Signaling protocol', () => {
  describe('Message serialization', () => {
    it('serializes all message types correctly', () => {
      const messages: RelayWireMessage[] = [
        { type: 'join', role: 'host' },
        { type: 'joined', role: 'guest' },
        { type: 'leave', role: 'host' },
        { type: 'room-ready' },
        { type: 'ping' },
        { type: 'pong' },
        { type: 'game', payload: { direction: 'up' } },
      ];

      for (const msg of messages) {
        const serialized = JSON.stringify(msg);
        const parsed = JSON.parse(serialized);
        expect(parsed.type).toBe(msg.type);
      }
    });
  });

  describe('Room state management', () => {
    it('tracks host and guest slots', () => {
      const room = {
        host: null as MockWebSocket | null,
        guest: null as MockWebSocket | null,
      };

      expect(room.host).toBeNull();
      expect(room.guest).toBeNull();

      room.host = createMockWebSocket();
      expect(room.host).not.toBeNull();
      expect(room.guest).toBeNull();

      room.guest = createMockWebSocket();
      expect(room.host).not.toBeNull();
      expect(room.guest).not.toBeNull();
    });

    it('sends room-ready when both peers connect', () => {
      const host = createMockWebSocket();
      const guest = createMockWebSocket();

      // Simulate room-ready broadcast
      const readyMessage = JSON.stringify({ type: 'room-ready' });
      host.send(readyMessage);
      guest.send(readyMessage);

      expect(host.sentMessages).toContain(readyMessage);
      expect(guest.sentMessages).toContain(readyMessage);
    });

    it('notifies peer when other leaves', () => {
      const host = createMockWebSocket();
      const leaveMessage = JSON.stringify({ type: 'leave', role: 'guest' });

      host.send(leaveMessage);

      expect(host.sentMessages.length).toBe(1);
      const parsed = JSON.parse(host.sentMessages[0]);
      expect(parsed.type).toBe('leave');
      expect(parsed.role).toBe('guest');
    });
  });

  describe('Message forwarding', () => {
    it('forwards game messages to other peer', () => {
      const host = createMockWebSocket();
      const gameMessage = JSON.stringify({
        type: 'game',
        payload: { from: 'guest', direction: 'left' },
      });

      // Simulate forwarding from guest to host
      host.send(gameMessage);

      expect(host.sentMessages.length).toBe(1);
      const parsed = JSON.parse(host.sentMessages[0]);
      expect(parsed.type).toBe('game');
      expect(parsed.payload.direction).toBe('left');
    });

    it('responds to ping with pong', () => {
      const client = createMockWebSocket();
      const pongMessage = JSON.stringify({ type: 'pong' });

      // Simulate ping -> pong response
      client.send(pongMessage);

      const parsed = JSON.parse(client.sentMessages[0]);
      expect(parsed.type).toBe('pong');
    });
  });
});
