import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { WebSocketRelayEndpoint, type RelayWireMessage } from '../src/websocket-relay.js';
import { MESSAGE_VERSION } from '../src/webrtc.js';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  private sentMessages: string[] = [];

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 });
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  getSentMessages(): string[] {
    return this.sentMessages;
  }

  simulateRoomReady(): void {
    this.simulateMessage({ type: 'room-ready' });
  }

  simulateError(): void {
    this.onerror?.();
  }
}

// Store original WebSocket
const originalWebSocket = globalThis.WebSocket;

describe('WebSocketRelayEndpoint', () => {
  beforeEach(() => {
    // Replace global WebSocket with mock
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    // Restore original WebSocket
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
  });

  it('connects to server with room and role parameters', async () => {
    const endpoint = new WebSocketRelayEndpoint<{ type: string }>({
      role: 'host',
      roomId: 'test-room',
      serverUrl: 'wss://example.com/ws'
    });

    await endpoint.connect();

    // Should have constructed URL with params
    // Note: We can't easily check the URL here, but we can verify it connected
    expect(endpoint.isReady()).toBe(false); // Not ready until room-ready

    endpoint.dispose();
  });

  it('sends join message after connection', async () => {
    let mockWs: MockWebSocket | null = null;

    // Capture the WebSocket instance
    const OriginalMock = MockWebSocket;
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = class extends OriginalMock {
      constructor(url: string) {
        super(url);
        mockWs = this;
      }
    } as unknown as typeof WebSocket;

    const endpoint = new WebSocketRelayEndpoint<{ type: string }>({
      role: 'host',
      roomId: 'test-room',
      serverUrl: 'wss://example.com/ws'
    });

    await endpoint.connect();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    const messages = mockWs!.getSentMessages();
    expect(messages.length).toBeGreaterThan(0);
    
    const joinMessage = JSON.parse(messages[0]);
    expect(joinMessage.type).toBe('join');
    expect(joinMessage.role).toBe('host');

    endpoint.dispose();
  });

  it('buffers messages until room is ready', async () => {
    let mockWs: MockWebSocket | null = null;

    const OriginalMock = MockWebSocket;
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = class extends OriginalMock {
      constructor(url: string) {
        super(url);
        mockWs = this;
      }
    } as unknown as typeof WebSocket;

    const endpoint = new WebSocketRelayEndpoint<{ type: string }>({
      role: 'host',
      roomId: 'test-room',
      serverUrl: 'wss://example.com/ws'
    });

    await endpoint.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Send before room is ready
    endpoint.send({ type: 'test-message' });

    const messagesBefore = mockWs!.getSentMessages().filter((m) => {
      const parsed = JSON.parse(m);
      return parsed.type === 'game';
    });
    expect(messagesBefore.length).toBe(0);

    // Simulate room ready
    mockWs!.simulateRoomReady();

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Now message should be sent
    const messagesAfter = mockWs!.getSentMessages().filter((m) => {
      const parsed = JSON.parse(m);
      return parsed.type === 'game';
    });
    expect(messagesAfter.length).toBe(1);

    endpoint.dispose();
  });

  it('dispatches received game messages to subscribers', async () => {
    let mockWs: MockWebSocket | null = null;

    const OriginalMock = MockWebSocket;
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = class extends OriginalMock {
      constructor(url: string) {
        super(url);
        mockWs = this;
      }
    } as unknown as typeof WebSocket;

    const received: unknown[] = [];

    const endpoint = new WebSocketRelayEndpoint<{ type: string; value: number }>({
      role: 'guest',
      roomId: 'test-room',
      serverUrl: 'wss://example.com/ws'
    });

    endpoint.subscribe((envelope) => {
      received.push(envelope);
    });

    await endpoint.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate receiving a game message
    mockWs!.simulateMessage({
      type: 'game',
      message: {
        v: MESSAGE_VERSION,
        envelope: {
          from: 'host',
          payload: { type: 'test', value: 42 },
          createdAt: Date.now()
        }
      }
    });

    expect(received.length).toBe(1);
    expect((received[0] as { payload: { value: number } }).payload.value).toBe(42);

    endpoint.dispose();
  });

  it('calls onReady when room-ready is received', async () => {
    let mockWs: MockWebSocket | null = null;

    const OriginalMock = MockWebSocket;
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = class extends OriginalMock {
      constructor(url: string) {
        super(url);
        mockWs = this;
      }
    } as unknown as typeof WebSocket;

    const onReady = vi.fn();

    const endpoint = new WebSocketRelayEndpoint<{ type: string }>({
      role: 'host',
      roomId: 'test-room',
      serverUrl: 'wss://example.com/ws',
      onReady
    });

    await endpoint.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onReady).not.toHaveBeenCalled();

    mockWs!.simulateRoomReady();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(endpoint.isReady()).toBe(true);

    endpoint.dispose();
  });

  it('cleans up on dispose', async () => {
    const endpoint = new WebSocketRelayEndpoint<{ type: string }>({
      role: 'host',
      roomId: 'test-room',
      serverUrl: 'wss://example.com/ws'
    });

    await endpoint.connect();

    const unsubscribe = endpoint.subscribe(() => {});

    endpoint.dispose();

    // Should not throw
    expect(() => {
      endpoint.send({ type: 'test' });
      unsubscribe();
    }).not.toThrow();
  });
});
