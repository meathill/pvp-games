/**
 * Connection Manager with WebRTC-first, WebSocket fallback strategy
 *
 * This module provides a unified interface for establishing peer connections,
 * automatically falling back to WebSocket relay when WebRTC fails.
 */

import type { PeerRole, RealtimeEndpoint, RealtimeEnvelope } from './realtime';
import { WebRTCRealtimeEndpoint, type SignalingChannel, type SignalingMessage } from './webrtc';
import { WebSocketRelayEndpoint } from './websocket-relay';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'signaling'
  | 'webrtc-connecting'
  | 'webrtc-connected'
  | 'fallback-connecting'
  | 'fallback-connected'
  | 'failed';

export type TransportType = 'webrtc' | 'websocket-relay' | 'none';

export interface ConnectionManagerOptions<TPayload> {
  role: PeerRole;
  roomId: string;
  relayServerUrl: string;
  iceServers?: RTCIceServer[];
  /** Timeout in ms for WebRTC connection attempt before fallback */
  webrtcTimeout?: number;
  onStateChange?: (state: ConnectionState) => void;
  onTransportChange?: (transport: TransportType) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
}

type Listener<TPayload> = (envelope: RealtimeEnvelope<TPayload>) => void;

const DEFAULT_WEBRTC_TIMEOUT = 10000; // 10 seconds

/**
 * Signaling channel that uses WebSocket relay for signaling
 */
class WebSocketSignalingChannel implements SignalingChannel {
  private handlers = new Set<(message: SignalingMessage) => void>();
  private ws: WebSocket | null = null;
  private pendingMessages: SignalingMessage[] = [];

  constructor(
    private readonly roomId: string,
    private readonly role: PeerRole,
  ) {}

  async connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(serverUrl);
      url.searchParams.set('room', this.roomId);
      url.searchParams.set('role', this.role);
      url.searchParams.set('mode', 'signaling');

      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        // Flush pending messages
        for (const msg of this.pendingMessages) {
          this.send(msg);
        }
        this.pendingMessages = [];
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'signaling' && data.payload) {
            this.handlers.forEach((handler) => handler(data.payload));
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onerror = () => {
        reject(new Error('Signaling WebSocket error'));
      };
    });
  }

  send(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingMessages.push(message);
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: 'signaling',
        payload: message,
      }),
    );
  }

  onMessage(handler: (message: SignalingMessage) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}

export class ConnectionManager<TPayload> implements RealtimeEndpoint<TPayload> {
  public readonly role: PeerRole;

  private readonly listeners = new Set<Listener<TPayload>>();
  private readonly roomId: string;
  private readonly relayServerUrl: string;
  private readonly iceServers?: RTCIceServer[];
  private readonly webrtcTimeout: number;
  private readonly onStateChange?: (state: ConnectionState) => void;
  private readonly onTransportChange?: (transport: TransportType) => void;
  private readonly onError?: (error: Error) => void;
  private readonly onReady?: () => void;

  private state: ConnectionState = 'disconnected';
  private transport: TransportType = 'none';
  private activeEndpoint: RealtimeEndpoint<TPayload> | null = null;
  private signalingChannel: WebSocketSignalingChannel | null = null;
  private endpointUnsubscribe: (() => void) | null = null;
  private disposed = false;

  constructor(options: ConnectionManagerOptions<TPayload>) {
    this.role = options.role;
    this.roomId = options.roomId;
    this.relayServerUrl = options.relayServerUrl;
    this.iceServers = options.iceServers;
    this.webrtcTimeout = options.webrtcTimeout ?? DEFAULT_WEBRTC_TIMEOUT;
    this.onStateChange = options.onStateChange;
    this.onTransportChange = options.onTransportChange;
    this.onError = options.onError;
    this.onReady = options.onReady;
  }

  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error('Connection manager has been disposed');
    }

    this.updateState('connecting');

    // Try WebRTC first
    try {
      await this.tryWebRTC();
      return;
    } catch (error) {
      console.warn('WebRTC connection failed, falling back to WebSocket relay:', error);
    }

    // Fall back to WebSocket relay
    try {
      await this.tryWebSocketRelay();
    } catch (error) {
      this.updateState('failed');
      throw error;
    }
  }

  send(payload: TPayload): void {
    if (this.disposed || !this.activeEndpoint) return;
    this.activeEndpoint.send(payload);
  }

  subscribe(listener: Listener<TPayload>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.endpointUnsubscribe?.();
    this.signalingChannel?.close();

    if (this.activeEndpoint) {
      if ('dispose' in this.activeEndpoint && typeof this.activeEndpoint.dispose === 'function') {
        (this.activeEndpoint as { dispose(): void }).dispose();
      }
    }

    this.listeners.clear();
    this.activeEndpoint = null;
    this.updateState('disconnected');
    this.updateTransport('none');
  }

  getState(): ConnectionState {
    return this.state;
  }

  getTransport(): TransportType {
    return this.transport;
  }

  isReady(): boolean {
    return this.activeEndpoint !== null && (this.state === 'webrtc-connected' || this.state === 'fallback-connected');
  }

  private async tryWebRTC(): Promise<void> {
    this.updateState('signaling');

    // Set up signaling channel via WebSocket
    this.signalingChannel = new WebSocketSignalingChannel(this.roomId, this.role);
    await this.signalingChannel.connect(this.relayServerUrl);

    this.updateState('webrtc-connecting');

    const webrtcEndpoint = new WebRTCRealtimeEndpoint<TPayload>({
      role: this.role,
      signaling: this.signalingChannel,
      iceServers: this.iceServers,
      onStateChange: (state) => {
        if (state === 'connected') {
          this.updateState('webrtc-connected');
        } else if (state === 'failed' || state === 'disconnected') {
          // Connection lost, might need to reconnect or fallback
          if (this.state === 'webrtc-connected') {
            this.handleDisconnection();
          }
        }
      },
      onError: (error) => {
        this.onError?.(error);
      },
      onReady: () => {
        this.onReady?.();
      },
    });

    // Set up timeout for WebRTC connection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('WebRTC connection timeout'));
      }, this.webrtcTimeout);
    });

    const connectionPromise = new Promise<void>((resolve, reject) => {
      webrtcEndpoint
        .connect()
        .then(() => {
          // Connection initiated, wait for data channel to be ready
          const interval = setInterval(() => {
            if (this.disposed) {
              clearInterval(interval);
              reject(new Error('Disposed'));
              return;
            }
            if (webrtcEndpoint.isReady()) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        })
        .catch(reject);
    });

    await Promise.race([connectionPromise, timeoutPromise]);

    // WebRTC connected successfully
    this.activeEndpoint = webrtcEndpoint;
    this.updateTransport('webrtc');
    this.updateState('webrtc-connected');

    // Forward messages
    this.endpointUnsubscribe = webrtcEndpoint.subscribe((envelope) => {
      this.listeners.forEach((listener) => listener(envelope));
    });
  }

  private async tryWebSocketRelay(): Promise<void> {
    this.updateState('fallback-connecting');

    // Clean up any existing signaling channel
    this.signalingChannel?.close();
    this.signalingChannel = null;

    const relayEndpoint = new WebSocketRelayEndpoint<TPayload>({
      role: this.role,
      roomId: this.roomId,
      serverUrl: this.relayServerUrl,
      onStateChange: (state) => {
        if (state === 'connected') {
          // Wait for room-ready
        } else if (state === 'disconnected' || state === 'error') {
          if (this.state === 'fallback-connected') {
            this.handleDisconnection();
          }
        }
      },
      onError: (error) => {
        this.onError?.(error);
      },
      onReady: () => {
        this.updateState('fallback-connected');
        this.onReady?.();
      },
    });

    await relayEndpoint.connect();

    this.activeEndpoint = relayEndpoint;
    this.updateTransport('websocket-relay');

    // Forward messages
    this.endpointUnsubscribe = relayEndpoint.subscribe((envelope) => {
      this.listeners.forEach((listener) => listener(envelope));
    });

    // Wait for room to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket relay timeout'));
      }, this.webrtcTimeout);

      const checkReady = () => {
        if (relayEndpoint.isReady()) {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check periodically
      const interval = setInterval(() => {
        if (this.disposed) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error('Disposed'));
          return;
        }
        checkReady();
      }, 100);

      // Also check immediately in case already ready
      checkReady();
    });

    this.updateState('fallback-connected');
  }

  private handleDisconnection(): void {
    // Could implement auto-reconnection here
    this.updateState('disconnected');
    this.onError?.(new Error('Connection lost'));
  }

  private updateState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.onStateChange?.(state);
    }
  }

  private updateTransport(transport: TransportType): void {
    if (this.transport !== transport) {
      this.transport = transport;
      this.onTransportChange?.(transport);
    }
  }
}

/**
 * Create a connection manager with sensible defaults
 */
export function createConnectionManager<TPayload>(
  options: ConnectionManagerOptions<TPayload>,
): ConnectionManager<TPayload> {
  return new ConnectionManager(options);
}
