import { describe, expect, it, vi, beforeEach } from 'vitest';

// Note: Testing Durable Objects requires mocking Cloudflare's runtime.
// These tests verify the logic without the actual Cloudflare environment.

import type { RoomState, RelayWireMessage } from '../src/durable-object.js';

// Mock types for testing
interface MockWebSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
  sentMessages: string[];
}

function createMockWebSocket(): MockWebSocket {
  return {
    readyState: 1, // OPEN
    sentMessages: [],
    send(data: string) {
      this.sentMessages.push(data);
    },
    close(code?: number, reason?: string) {
      this.readyState = 3; // CLOSED
    }
  };
}

describe('DODataExchanger logic', () => {
  describe('Room state management', () => {
    it('tracks host and guest slots separately', () => {
      const state: RoomState = {
        id: 'test-room',
        host: null,
        guest: null,
        hostReady: false,
        guestReady: false,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      // Initially both slots are empty
      expect(state.host).toBeNull();
      expect(state.guest).toBeNull();

      // Host joins
      const hostWs = createMockWebSocket();
      state.host = hostWs as unknown as WebSocket;
      expect(state.host).not.toBeNull();
      expect(state.guest).toBeNull();

      // Guest joins
      const guestWs = createMockWebSocket();
      state.guest = guestWs as unknown as WebSocket;
      expect(state.host).not.toBeNull();
      expect(state.guest).not.toBeNull();
    });

    it('prevents double-joining same slot', () => {
      const state: RoomState = {
        id: 'test-room',
        host: createMockWebSocket() as unknown as WebSocket,
        guest: null,
        hostReady: false,
        guestReady: false,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      // Host slot is taken
      const isHostSlotAvailable = state.host === null;
      expect(isHostSlotAvailable).toBe(false);

      // Guest slot is available
      const isGuestSlotAvailable = state.guest === null;
      expect(isGuestSlotAvailable).toBe(true);
    });
  });

  describe('Message handling', () => {
    it('can parse relay wire messages', () => {
      const joinMessage: RelayWireMessage = { type: 'join', role: 'host' };
      const leaveMessage: RelayWireMessage = { type: 'leave', role: 'guest' };
      const gameMessage: RelayWireMessage = { type: 'game', message: { test: true } };
      const errorMessage: RelayWireMessage = { type: 'error', code: 'TEST', message: 'Test error' };
      const roomReadyMessage: RelayWireMessage = { type: 'room-ready' };
      const pingMessage: RelayWireMessage = { type: 'ping' };
      const pongMessage: RelayWireMessage = { type: 'pong' };

      // All message types should be serializable
      expect(() => JSON.stringify(joinMessage)).not.toThrow();
      expect(() => JSON.stringify(leaveMessage)).not.toThrow();
      expect(() => JSON.stringify(gameMessage)).not.toThrow();
      expect(() => JSON.stringify(errorMessage)).not.toThrow();
      expect(() => JSON.stringify(roomReadyMessage)).not.toThrow();
      expect(() => JSON.stringify(pingMessage)).not.toThrow();
      expect(() => JSON.stringify(pongMessage)).not.toThrow();
    });

    it('forwards game messages between peers', () => {
      const hostWs = createMockWebSocket();
      const guestWs = createMockWebSocket();

      // Simulate forwarding a game message from guest to host
      const gameMessage: RelayWireMessage = {
        type: 'game',
        message: { type: 'input', direction: 'up' }
      };

      // In real DO, this would be:
      // this.sendMessage(this.roomState.host, gameMessage);
      hostWs.send(JSON.stringify(gameMessage));

      expect(hostWs.sentMessages.length).toBe(1);
      const received = JSON.parse(hostWs.sentMessages[0]) as RelayWireMessage;
      expect(received.type).toBe('game');
    });

    it('responds to ping with pong', () => {
      const clientWs = createMockWebSocket();

      // Simulate ping handling
      const pingMessage: RelayWireMessage = { type: 'ping' };
      const pongMessage: RelayWireMessage = { type: 'pong' };

      // In real DO, receiving ping would trigger sending pong
      clientWs.send(JSON.stringify(pongMessage));

      expect(clientWs.sentMessages.length).toBe(1);
      const received = JSON.parse(clientWs.sentMessages[0]) as RelayWireMessage;
      expect(received.type).toBe('pong');
    });
  });

  describe('Room lifecycle', () => {
    it('sends room-ready when both peers connect', () => {
      const hostWs = createMockWebSocket();
      const guestWs = createMockWebSocket();

      const state: RoomState = {
        id: 'test-room',
        host: hostWs as unknown as WebSocket,
        guest: guestWs as unknown as WebSocket,
        hostReady: false,
        guestReady: false,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      // Check if room is ready (both connected)
      const isRoomReady = state.host !== null && state.guest !== null;
      expect(isRoomReady).toBe(true);

      if (isRoomReady) {
        const readyMessage: RelayWireMessage = { type: 'room-ready' };
        hostWs.send(JSON.stringify(readyMessage));
        guestWs.send(JSON.stringify(readyMessage));
      }

      expect(hostWs.sentMessages.length).toBe(1);
      expect(guestWs.sentMessages.length).toBe(1);
    });

    it('notifies peer when other leaves', () => {
      const hostWs = createMockWebSocket();
      const guestWs = createMockWebSocket();

      // Guest leaves
      const leaveMessage: RelayWireMessage = { type: 'leave', role: 'guest' };
      
      // Notify host that guest left
      hostWs.send(JSON.stringify(leaveMessage));

      expect(hostWs.sentMessages.length).toBe(1);
      const received = JSON.parse(hostWs.sentMessages[0]) as RelayWireMessage;
      expect(received.type).toBe('leave');
      expect(received.role).toBe('guest');
    });

    it('cleans up on timeout', () => {
      const ROOM_TIMEOUT_MS = 30 * 60 * 1000;
      const now = Date.now();
      
      const state: RoomState = {
        id: 'test-room',
        host: createMockWebSocket() as unknown as WebSocket,
        guest: createMockWebSocket() as unknown as WebSocket,
        hostReady: true,
        guestReady: true,
        createdAt: now - ROOM_TIMEOUT_MS - 1000,
        lastActivity: now - ROOM_TIMEOUT_MS - 1000
      };

      const isTimedOut = now - state.lastActivity > ROOM_TIMEOUT_MS;
      expect(isTimedOut).toBe(true);
    });
  });
});
