/**
 * WebRTC-based RealtimeEndpoint implementation
 *
 * This provides a real network transport layer that can be used instead of
 * the in-memory implementation for actual online play.
 */

import type { PeerRole, RealtimeEndpoint, RealtimeEnvelope } from './realtime';

export type SignalingMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
  | { type: 'ready' };

export interface SignalingChannel {
  send(message: SignalingMessage): void;
  onMessage(handler: (message: SignalingMessage) => void): () => void;
}

export interface WebRTCEndpointOptions<TPayload> {
  role: PeerRole;
  signaling: SignalingChannel;
  iceServers?: RTCIceServer[];
  onStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
  /** Called when data channel is open and ready */
  onReady?: () => void;
}

type Listener<TPayload> = (envelope: RealtimeEnvelope<TPayload>) => void;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const MESSAGE_VERSION = 1;

export interface VersionedMessage<TPayload> {
  v: number;
  envelope: RealtimeEnvelope<TPayload>;
}

export class WebRTCRealtimeEndpoint<TPayload> implements RealtimeEndpoint<TPayload> {
  public readonly role: PeerRole;

  private readonly listeners = new Set<Listener<TPayload>>();
  private readonly signaling: SignalingChannel;
  private readonly iceServers: RTCIceServer[];
  private readonly onStateChange?: (state: RTCPeerConnectionState) => void;
  private readonly onError?: (error: Error) => void;
  private readonly onReady?: () => void;

  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pendingMessages: TPayload[] = [];
  private signalingCleanup: (() => void) | null = null;
  private disposed = false;

  constructor(options: WebRTCEndpointOptions<TPayload>) {
    this.role = options.role;
    this.signaling = options.signaling;
    this.iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
    this.onStateChange = options.onStateChange;
    this.onError = options.onError;
    this.onReady = options.onReady;
  }

  /**
   * Initialize the WebRTC connection.
   * Host creates offer, guest waits for offer then creates answer.
   */
  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error('Endpoint has been disposed');
    }

    this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.onStateChange?.(this.pc.connectionState);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Set up signaling message handler
    this.signalingCleanup = this.signaling.onMessage(async (message) => {
      if (this.disposed || !this.pc) return;

      try {
        await this.handleSignalingMessage(message);
      } catch (error) {
        this.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    if (this.role === 'host') {
      await this.initiateAsHost();
    }
    // Guest waits for offer via signaling
  }

  send(payload: TPayload): void {
    if (this.disposed) return;

    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      // Buffer messages until channel is ready
      this.pendingMessages.push(payload);
      return;
    }

    const envelope: RealtimeEnvelope<TPayload> = {
      from: this.role,
      payload,
      createdAt: Date.now(),
    };

    const message: VersionedMessage<TPayload> = {
      v: MESSAGE_VERSION,
      envelope,
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
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
    this.signalingCleanup?.();
    this.dataChannel?.close();
    this.pc?.close();
    this.listeners.clear();
    this.pendingMessages = [];
  }

  getConnectionState(): RTCPeerConnectionState | 'disconnected' {
    return this.pc?.connectionState ?? 'disconnected';
  }

  isReady(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  private async initiateAsHost(): Promise<void> {
    if (!this.pc) return;

    // Host creates the data channel
    this.dataChannel = this.pc.createDataChannel('game', {
      ordered: true,
    });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.signaling.send({
      type: 'offer',
      sdp: offer.sdp!,
    });
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.pc) return;

    switch (message.type) {
      case 'offer':
        // Guest receives offer
        if (this.role === 'guest') {
          // Guest sets up handler for incoming data channel
          this.pc.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel(this.dataChannel);
          };

          await this.pc.setRemoteDescription({
            type: 'offer',
            sdp: message.sdp,
          });

          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);

          this.signaling.send({
            type: 'answer',
            sdp: answer.sdp!,
          });
        }
        break;

      case 'answer':
        // Host receives answer
        if (this.role === 'host') {
          await this.pc.setRemoteDescription({
            type: 'answer',
            sdp: message.sdp,
          });
        }
        break;

      case 'ice-candidate':
        await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        break;
    }
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      // Flush pending messages
      for (const payload of this.pendingMessages) {
        this.send(payload);
      }
      this.pendingMessages = [];
      this.onReady?.();
    };

    channel.onmessage = (event) => {
      try {
        const message: VersionedMessage<TPayload> = JSON.parse(event.data);

        // Version check for forward compatibility
        if (message.v !== MESSAGE_VERSION) {
          console.warn(`Received message with version ${message.v}, expected ${MESSAGE_VERSION}`);
        }

        this.listeners.forEach((listener) => listener(message.envelope));
      } catch (error) {
        this.onError?.(error instanceof Error ? error : new Error('Failed to parse message'));
      }
    };

    channel.onerror = (event) => {
      this.onError?.(new Error('Data channel error'));
    };

    channel.onclose = () => {
      this.onStateChange?.('disconnected');
    };
  }
}

/**
 * Create a pair of WebRTC endpoints for testing with mock signaling
 */
export function createWebRTCEndpointPair<TPayload>(
  options?: Partial<Omit<WebRTCEndpointOptions<TPayload>, 'role' | 'signaling'>>,
): {
  host: WebRTCRealtimeEndpoint<TPayload>;
  guest: WebRTCRealtimeEndpoint<TPayload>;
  hostSignaling: MockSignalingChannel;
  guestSignaling: MockSignalingChannel;
} {
  const hostSignaling = new MockSignalingChannel();
  const guestSignaling = new MockSignalingChannel();

  // Link them together
  hostSignaling.linkTo(guestSignaling);
  guestSignaling.linkTo(hostSignaling);

  const host = new WebRTCRealtimeEndpoint<TPayload>({
    ...options,
    role: 'host',
    signaling: hostSignaling,
  });

  const guest = new WebRTCRealtimeEndpoint<TPayload>({
    ...options,
    role: 'guest',
    signaling: guestSignaling,
  });

  return { host, guest, hostSignaling, guestSignaling };
}

/**
 * Mock signaling channel for testing
 */
export class MockSignalingChannel implements SignalingChannel {
  private handlers = new Set<(message: SignalingMessage) => void>();
  private remote: MockSignalingChannel | null = null;

  linkTo(remote: MockSignalingChannel): void {
    this.remote = remote;
  }

  send(message: SignalingMessage): void {
    // Simulate async delivery
    setTimeout(() => {
      this.remote?.handlers.forEach((handler) => handler(message));
    }, 0);
  }

  onMessage(handler: (message: SignalingMessage) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
