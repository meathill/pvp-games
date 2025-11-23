/**
 * WebSocket-based Relay implementation
 * 
 * This provides a fallback transport when WebRTC cannot establish a direct connection.
 * It connects to a Cloudflare Durable Object that relays messages between peers.
 */

import type { PeerRole, RealtimeEndpoint, RealtimeEnvelope } from './realtime';
import { MESSAGE_VERSION, type VersionedMessage } from './webrtc';

export interface WebSocketRelayOptions<TPayload> {
  role: PeerRole;
  roomId: string;
  serverUrl: string;
  onStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
  /** Reconnection attempts before giving up */
  maxReconnectAttempts?: number;
  /** Base delay in ms for exponential backoff */
  reconnectBaseDelay?: number;
}

type Listener<TPayload> = (envelope: RealtimeEnvelope<TPayload>) => void;

/** Wire protocol for relay messages */
export type RelayWireMessage<TPayload> =
  | { type: 'join'; role: PeerRole }
  | { type: 'leave'; role: PeerRole }
  | { type: 'game'; message: VersionedMessage<TPayload> }
  | { type: 'error'; code: string; message: string }
  | { type: 'room-ready' }
  | { type: 'ping' }
  | { type: 'pong' };

export class WebSocketRelayEndpoint<TPayload> implements RealtimeEndpoint<TPayload> {
  public readonly role: PeerRole;

  private readonly listeners = new Set<Listener<TPayload>>();
  private readonly roomId: string;
  private readonly serverUrl: string;
  private readonly onStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  private readonly onError?: (error: Error) => void;
  private readonly onReady?: () => void;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelay: number;

  private ws: WebSocket | null = null;
  private pendingMessages: TPayload[] = [];
  private disposed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private roomReady = false;

  constructor(options: WebSocketRelayOptions<TPayload>) {
    this.role = options.role;
    this.roomId = options.roomId;
    this.serverUrl = options.serverUrl;
    this.onStateChange = options.onStateChange;
    this.onError = options.onError;
    this.onReady = options.onReady;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectBaseDelay = options.reconnectBaseDelay ?? 1000;
  }

  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error('Endpoint has been disposed');
    }

    return this.doConnect();
  }

  send(payload: TPayload): void {
    if (this.disposed) return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.roomReady) {
      this.pendingMessages.push(payload);
      return;
    }

    const envelope: RealtimeEnvelope<TPayload> = {
      from: this.role,
      payload,
      createdAt: Date.now()
    };

    const wireMessage: RelayWireMessage<TPayload> = {
      type: 'game',
      message: {
        v: MESSAGE_VERSION,
        envelope
      }
    };

    try {
      this.ws.send(JSON.stringify(wireMessage));
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error('Failed to send message'));
    }
  }

  subscribe(listener: Listener<TPayload>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.clearReconnectTimer();
    this.clearPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Disposed');
      this.ws = null;
    }
    
    this.listeners.clear();
    this.pendingMessages = [];
  }

  isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.roomReady;
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.serverUrl);
      url.searchParams.set('room', this.roomId);
      url.searchParams.set('role', this.role);

      this.onStateChange?.('connecting');

      try {
        this.ws = new WebSocket(url.toString());
      } catch (error) {
        this.onStateChange?.('error');
        reject(error);
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.onStateChange?.('connected');
        
        // Send join message
        const joinMessage: RelayWireMessage<TPayload> = {
          type: 'join',
          role: this.role
        };
        this.ws?.send(JSON.stringify(joinMessage));

        // Start ping interval to keep connection alive
        this.startPingInterval();

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const wireMessage: RelayWireMessage<TPayload> = JSON.parse(event.data);
          this.handleWireMessage(wireMessage);
        } catch (error) {
          this.onError?.(error instanceof Error ? error : new Error('Failed to parse message'));
        }
      };

      this.ws.onerror = () => {
        this.onStateChange?.('error');
        this.onError?.(new Error('WebSocket error'));
      };

      this.ws.onclose = (event) => {
        this.roomReady = false;
        this.clearPingInterval();
        
        if (!this.disposed && event.code !== 1000) {
          this.onStateChange?.('disconnected');
          this.attemptReconnect();
        }
      };
    });
  }

  private handleWireMessage(wireMessage: RelayWireMessage<TPayload>): void {
    switch (wireMessage.type) {
      case 'game':
        // Version check
        if (wireMessage.message.v !== MESSAGE_VERSION) {
          console.warn(`Received message with version ${wireMessage.message.v}, expected ${MESSAGE_VERSION}`);
        }
        this.listeners.forEach((listener) => listener(wireMessage.message.envelope));
        break;

      case 'room-ready':
        this.roomReady = true;
        // Flush pending messages
        for (const payload of this.pendingMessages) {
          this.send(payload);
        }
        this.pendingMessages = [];
        this.onReady?.();
        break;

      case 'error':
        this.onError?.(new Error(`${wireMessage.code}: ${wireMessage.message}`));
        break;

      case 'pong':
        // Connection is alive
        break;

      case 'leave':
        // Other peer left
        this.onStateChange?.('disconnected');
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.disposed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onError?.(new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.doConnect();
      } catch {
        this.attemptReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMessage: RelayWireMessage<TPayload> = { type: 'ping' };
        this.ws.send(JSON.stringify(pingMessage));
      }
    }, 30000); // Ping every 30 seconds
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
