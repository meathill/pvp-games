import type { RealtimeEndpoint, RealtimeEnvelope, PeerRole } from '@pvp-games/shared';
import type { DuelSnakeWireMessage } from './online';

// Network constants
const WEBRTC_TIMEOUT_MS = 5000; // Give WebRTC 5 seconds to connect
const PING_INTERVAL_MS = 2000;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'signaling' | 'ready' | 'playing' | 'error';
export type TransportType = 'webrtc' | 'websocket';

/**
 * Hybrid transport that tries WebRTC first, falls back to WebSocket
 */
export class HybridTransport implements RealtimeEndpoint<DuelSnakeWireMessage> {
    public readonly role: PeerRole;
    private ws: WebSocket | null = null;
    private pc: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private listeners = new Set<(envelope: RealtimeEnvelope<DuelSnakeWireMessage>) => void>();
    private pendingMessages: DuelSnakeWireMessage[] = [];
    private disposed = false;
    private roomReady = false;
    private webrtcReady = false;
    private iceServers: RTCIceServer[] = [];
    private webrtcTimeout: number | null = null;
    private pingInterval: number | null = null;
    private lastPingTime = 0;

    public transportType: TransportType = 'websocket';
    public latency = 0;

    constructor(
        role: PeerRole,
        private readonly serverUrl: string,
        private readonly roomId: string,
        private readonly onStatusChange: (status: ConnectionStatus) => void,
        private readonly onError: (error: string) => void,
        private readonly onTransportChange?: (type: TransportType) => void,
        private readonly onLatencyUpdate?: (latency: number) => void,
    ) {
        this.role = role;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.disposed) {
                reject(new Error('Transport disposed'));
                return;
            }

            const url = new URL(this.serverUrl);
            url.searchParams.set('room', this.roomId);
            url.searchParams.set('role', this.role);

            this.onStatusChange('connecting');

            try {
                this.ws = new WebSocket(url.toString());
            } catch (error) {
                this.onStatusChange('error');
                reject(error);
                return;
            }

            this.ws.onopen = () => {
                if (this.disposed) return;
                this.onStatusChange('waiting');
                this.startPingInterval();
                resolve();
            };

            this.ws.onmessage = (event) => {
                if (this.disposed) return;
                this.handleWebSocketMessage(event.data);
            };

            this.ws.onerror = () => {
                if (this.disposed) return;
                this.onStatusChange('error');
                this.onError('连接出错');
            };

            this.ws.onclose = (event) => {
                if (this.disposed) return;
                this.stopPingInterval();
                if (event.code !== 1000) {
                    this.onStatusChange('error');
                    this.onError(`连接已断开 (${event.code})`);
                } else {
                    this.onStatusChange('disconnected');
                }
            };
        });
    }

    private handleWebSocketMessage(data: string): void {
        try {
            const msg = JSON.parse(data);

            switch (msg.type) {
                case 'joined':
                    // Just confirmation, wait for room-ready
                    break;

                case 'room-ready':
                    this.roomReady = true;
                    this.iceServers = msg.iceServers || [];
                    this.onStatusChange('signaling');
                    this.initiateWebRTC();
                    break;

                case 'leave':
                    this.onError('对方已离开房间');
                    this.onStatusChange('disconnected');
                    break;

                case 'pong':
                    this.latency = Date.now() - this.lastPingTime;
                    this.onLatencyUpdate?.(this.latency);
                    break;

                // WebRTC signaling messages
                case 'offer':
                    this.handleOffer(msg.sdp);
                    break;

                case 'answer':
                    this.handleAnswer(msg.sdp);
                    break;

                case 'ice-candidate':
                    this.handleIceCandidate(msg.candidate);
                    break;

                // Game messages (WebSocket relay fallback)
                case 'game':
                    if (!this.webrtcReady) {
                        this.dispatchGameMessage(msg.payload);
                    }
                    break;

                default:
                    // Try to dispatch as game message
                    if (msg.from && msg.payload) {
                        if (!this.webrtcReady) {
                            this.listeners.forEach((listener) => listener(msg));
                        }
                    } else if (msg.type) {
                        // Wrap raw messages
                        const envelope: RealtimeEnvelope<DuelSnakeWireMessage> = {
                            from: this.role === 'host' ? 'guest' : 'host',
                            payload: msg,
                            createdAt: Date.now(),
                        };
                        if (!this.webrtcReady) {
                            this.listeners.forEach((listener) => listener(envelope));
                        }
                    }
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    private initiateWebRTC(): void {
        if (this.disposed) return;

        // Set timeout for WebRTC connection
        this.webrtcTimeout = window.setTimeout(() => {
            if (!this.webrtcReady) {
                console.log('WebRTC timeout, using WebSocket relay');
                this.transportType = 'websocket';
                this.onTransportChange?.('websocket');
                this.onStatusChange('ready');
                this.notifyWebRTCFailed();
                this.flushPendingMessages();
            }
        }, WEBRTC_TIMEOUT_MS);

        this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

        this.pc.onicecandidate = (event) => {
            if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(
                    JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate.toJSON(),
                    }),
                );
            }
        };

        this.pc.onconnectionstatechange = () => {
            if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'disconnected') {
                if (this.webrtcReady) {
                    // WebRTC was working but disconnected, fall back to WebSocket
                    console.log('WebRTC disconnected, falling back to WebSocket');
                    this.webrtcReady = false;
                    this.transportType = 'websocket';
                    this.onTransportChange?.('websocket');
                }
            }
        };

        if (this.role === 'host') {
            // Host creates data channel and offer
            this.dataChannel = this.pc.createDataChannel('game', { ordered: true });
            this.setupDataChannel(this.dataChannel);

            this.pc.createOffer().then((offer) => {
                return this.pc!.setLocalDescription(offer).then(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
                    }
                });
            });
        } else {
            // Guest waits for data channel
            this.pc.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel(this.dataChannel);
            };
        }
    }

    private async handleOffer(sdp: string): Promise<void> {
        if (!this.pc || this.role !== 'guest') return;

        try {
            await this.pc.setRemoteDescription({ type: 'offer', sdp });
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
            }
        } catch (error) {
            console.error('Failed to handle offer:', error);
        }
    }

    private async handleAnswer(sdp: string): Promise<void> {
        if (!this.pc || this.role !== 'host') return;

        try {
            await this.pc.setRemoteDescription({ type: 'answer', sdp });
        } catch (error) {
            console.error('Failed to handle answer:', error);
        }
    }

    private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.pc) return;

        try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    private setupDataChannel(channel: RTCDataChannel): void {
        channel.onopen = () => {
            console.log('WebRTC DataChannel opened');
            if (this.webrtcTimeout) {
                clearTimeout(this.webrtcTimeout);
                this.webrtcTimeout = null;
            }

            this.webrtcReady = true;
            this.transportType = 'webrtc';
            this.onTransportChange?.('webrtc');
            this.onStatusChange('ready');
            this.notifyWebRTCReady();
            this.flushPendingMessages();
        };

        channel.onmessage = (event) => {
            this.dispatchGameMessage(JSON.parse(event.data));
        };

        channel.onerror = (event) => {
            console.error('DataChannel error:', event);
        };

        channel.onclose = () => {
            console.log('DataChannel closed');
            if (this.webrtcReady) {
                this.webrtcReady = false;
                this.transportType = 'websocket';
                this.onTransportChange?.('websocket');
            }
        };
    }

    private dispatchGameMessage(payload: DuelSnakeWireMessage): void {
        const envelope: RealtimeEnvelope<DuelSnakeWireMessage> = {
            from: this.role === 'host' ? 'guest' : 'host',
            payload,
            createdAt: Date.now(),
        };
        this.listeners.forEach((listener) => listener(envelope));
    }

    private notifyWebRTCReady(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'webrtc-ready' }));
        }
    }

    private notifyWebRTCFailed(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'webrtc-failed' }));
        }
    }

    private flushPendingMessages(): void {
        for (const msg of this.pendingMessages) {
            this.send(msg);
        }
        this.pendingMessages = [];
    }

    private startPingInterval(): void {
        this.pingInterval = window.setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.lastPingTime = Date.now();
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, PING_INTERVAL_MS);
    }

    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    send(payload: DuelSnakeWireMessage): void {
        if (this.disposed) return;

        // If neither transport is ready, buffer the message
        if (!this.webrtcReady && (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.roomReady)) {
            this.pendingMessages.push(payload);
            return;
        }

        // Prefer WebRTC if available
        if (this.webrtcReady && this.dataChannel?.readyState === 'open') {
            try {
                this.dataChannel.send(JSON.stringify(payload));
                return;
            } catch (error) {
                console.warn('WebRTC send failed, falling back to WebSocket');
            }
        }

        // Fall back to WebSocket
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'game', payload }));
        }
    }

    subscribe(listener: (envelope: RealtimeEnvelope<DuelSnakeWireMessage>) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    dispose(): void {
        this.disposed = true;
        this.stopPingInterval();

        if (this.webrtcTimeout) {
            clearTimeout(this.webrtcTimeout);
        }

        this.dataChannel?.close();
        this.pc?.close();
        this.ws?.close(1000, 'Leaving');

        this.ws = null;
        this.pc = null;
        this.dataChannel = null;
        this.listeners.clear();
    }

    isReady(): boolean {
        return this.webrtcReady || (this.roomReady && this.ws?.readyState === WebSocket.OPEN);
    }
}
