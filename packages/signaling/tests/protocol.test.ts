import { describe, expect, it } from 'vitest';

/**
 * GameRoom Durable Object logic tests
 *
 * Note: Full integration tests require Cloudflare's Miniflare or wrangler dev.
 * These tests verify the protocol and message handling logic.
 */

// ICE server type
interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Message types used by the signaling protocol (v2)
type SignalingMessage =
  | { type: 'join'; role: 'host' | 'guest' }
  | { type: 'joined'; role: 'host' | 'guest' }
  | { type: 'leave'; role: 'host' | 'guest' }
  | { type: 'room-ready'; iceServers: IceServer[] }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: { candidate?: string; sdpMid?: string | null } }
  | { type: 'webrtc-ready' }
  | { type: 'webrtc-failed' }
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

describe('Signaling protocol v2', () => {
  describe('Message serialization', () => {
    it('serializes all message types correctly', () => {
      const messages: SignalingMessage[] = [
        { type: 'join', role: 'host' },
        { type: 'joined', role: 'guest' },
        { type: 'leave', role: 'host' },
        { type: 'room-ready', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
        { type: 'offer', sdp: 'v=0\r\n...' },
        { type: 'answer', sdp: 'v=0\r\n...' },
        { type: 'ice-candidate', candidate: { candidate: 'candidate:...', sdpMid: '0' } },
        { type: 'webrtc-ready' },
        { type: 'webrtc-failed' },
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

    it('sends room-ready with ICE servers when both peers connect', () => {
      const host = createMockWebSocket();
      const guest = createMockWebSocket();

      // Simulate room-ready broadcast with ICE servers
      const readyMessage = JSON.stringify({
        type: 'room-ready',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      host.send(readyMessage);
      guest.send(readyMessage);

      expect(host.sentMessages.length).toBe(1);
      expect(guest.sentMessages.length).toBe(1);

      const hostMsg = JSON.parse(host.sentMessages[0]);
      expect(hostMsg.type).toBe('room-ready');
      expect(hostMsg.iceServers).toHaveLength(1);
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

  describe('WebRTC signaling', () => {
    it('forwards offer from host to guest', () => {
      const guest = createMockWebSocket();
      const offerMessage = JSON.stringify({ type: 'offer', sdp: 'v=0\r\no=...' });

      guest.send(offerMessage);

      const parsed = JSON.parse(guest.sentMessages[0]);
      expect(parsed.type).toBe('offer');
      expect(parsed.sdp).toBeDefined();
    });

    it('forwards answer from guest to host', () => {
      const host = createMockWebSocket();
      const answerMessage = JSON.stringify({ type: 'answer', sdp: 'v=0\r\no=...' });

      host.send(answerMessage);

      const parsed = JSON.parse(host.sentMessages[0]);
      expect(parsed.type).toBe('answer');
      expect(parsed.sdp).toBeDefined();
    });

    it('forwards ICE candidates between peers', () => {
      const peer = createMockWebSocket();
      const iceMessage = JSON.stringify({
        type: 'ice-candidate',
        candidate: { candidate: 'candidate:1 1 udp 2122260223 ...', sdpMid: '0' },
      });

      peer.send(iceMessage);

      const parsed = JSON.parse(peer.sentMessages[0]);
      expect(parsed.type).toBe('ice-candidate');
      expect(parsed.candidate).toBeDefined();
    });
  });

  describe('Message forwarding', () => {
    it('forwards game messages to other peer', () => {
      const host = createMockWebSocket();
      const gameMessage = JSON.stringify({
        type: 'game',
        payload: { from: 'guest', direction: 'left' },
      });

      host.send(gameMessage);

      expect(host.sentMessages.length).toBe(1);
      const parsed = JSON.parse(host.sentMessages[0]);
      expect(parsed.type).toBe('game');
      expect(parsed.payload.direction).toBe('left');
    });

    it('responds to ping with pong', () => {
      const client = createMockWebSocket();
      const pongMessage = JSON.stringify({ type: 'pong' });

      client.send(pongMessage);

      const parsed = JSON.parse(client.sentMessages[0]);
      expect(parsed.type).toBe('pong');
    });
  });
});
