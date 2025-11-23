/**
 * Cloudflare Durable Object for game room management
 * 
 * Handles:
 * - WebRTC signaling (offer/answer/ICE exchange)
 * - WebSocket relay when WebRTC fails
 * - Room lifecycle management
 */

import type { PeerRole } from '@pvp-games/shared';

export interface RoomState {
  id: string;
  host: WebSocket | null;
  guest: WebSocket | null;
  hostReady: boolean;
  guestReady: boolean;
  createdAt: number;
  lastActivity: number;
}

/** ICE candidate info - serializable form */
export interface IceCandidateInfo {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string;
}

export type SignalingWireMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: IceCandidateInfo }
  | { type: 'ready' };

export type RelayWireMessage =
  | { type: 'join'; role: PeerRole }
  | { type: 'leave'; role: PeerRole }
  | { type: 'game'; message: unknown }
  | { type: 'error'; code: string; message: string }
  | { type: 'room-ready' }
  | { type: 'signaling'; payload: SignalingWireMessage }
  | { type: 'ping' }
  | { type: 'pong' };

const ROOM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class DODataExchanger {
  private state: DurableObjectState;
  private roomState: RoomState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.roomState = {
      id: state.id.toString(),
      host: null,
      guest: null,
      hostReady: false,
      guestReady: false,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // WebSocket upgrade
    if (upgradeHeader === 'websocket') {
      return this.handleWebSocket(request, url);
    }

    // REST API for room info
    if (url.pathname.endsWith('/info')) {
      return this.handleInfo();
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocket(request: Request, url: URL): Promise<Response> {
    const role = url.searchParams.get('role') as PeerRole | null;

    if (!role || (role !== 'host' && role !== 'guest')) {
      return new Response('Invalid role parameter', { status: 400 });
    }

    // Check if slot is available
    if (role === 'host' && this.roomState.host) {
      return new Response('Host slot already taken', { status: 409 });
    }
    if (role === 'guest' && this.roomState.guest) {
      return new Response('Guest slot already taken', { status: 409 });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    // Accept the WebSocket
    this.state.acceptWebSocket(server, [role]);

    // Store connection
    if (role === 'host') {
      this.roomState.host = server;
    } else {
      this.roomState.guest = server;
    }

    this.roomState.lastActivity = Date.now();

    // Check if room is ready (both peers connected)
    this.checkRoomReady();

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private handleInfo(): Response {
    const info = {
      id: this.roomState.id,
      hasHost: !!this.roomState.host,
      hasGuest: !!this.roomState.guest,
      hostReady: this.roomState.hostReady,
      guestReady: this.roomState.guestReady,
      createdAt: this.roomState.createdAt,
      lastActivity: this.roomState.lastActivity
    };

    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.roomState.lastActivity = Date.now();

    if (typeof message !== 'string') {
      return;
    }

    try {
      const data: RelayWireMessage = JSON.parse(message);
      const role = this.getRole(ws);

      if (!role) {
        this.sendError(ws, 'NOT_IN_ROOM', 'WebSocket not associated with a role');
        return;
      }

      await this.handleMessage(ws, role, data);
    } catch (error) {
      this.sendError(ws, 'PARSE_ERROR', 'Failed to parse message');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const role = this.getRole(ws);

    if (role === 'host') {
      this.roomState.host = null;
      this.roomState.hostReady = false;
    } else if (role === 'guest') {
      this.roomState.guest = null;
      this.roomState.guestReady = false;
    }

    // Notify the other peer
    const otherPeer = role === 'host' ? this.roomState.guest : this.roomState.host;
    if (otherPeer) {
      this.sendMessage(otherPeer, { type: 'leave', role: role! });
    }

    this.roomState.lastActivity = Date.now();
  }

  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error('WebSocket error:', error);
  }

  private async handleMessage(ws: WebSocket, role: PeerRole, data: RelayWireMessage): Promise<void> {
    const otherPeer = role === 'host' ? this.roomState.guest : this.roomState.host;

    switch (data.type) {
      case 'join':
        // Already handled in handleWebSocket
        break;

      case 'signaling':
        // Forward signaling messages to the other peer
        if (otherPeer) {
          this.sendMessage(otherPeer, data);
        }
        break;

      case 'game':
        // Forward game messages to the other peer
        if (otherPeer) {
          this.sendMessage(otherPeer, data);
        }
        break;

      case 'ping':
        this.sendMessage(ws, { type: 'pong' });
        break;

      default:
        // Unknown message type
        break;
    }
  }

  private checkRoomReady(): void {
    if (this.roomState.host && this.roomState.guest) {
      // Both peers are connected, notify them
      const readyMessage: RelayWireMessage = { type: 'room-ready' };
      this.sendMessage(this.roomState.host, readyMessage);
      this.sendMessage(this.roomState.guest, readyMessage);
    }
  }

  private getRole(ws: WebSocket): PeerRole | null {
    if (this.roomState.host === ws) return 'host';
    if (this.roomState.guest === ws) return 'guest';
    return null;
  }

  private sendMessage(ws: WebSocket, message: RelayWireMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.sendMessage(ws, { type: 'error', code, message });
  }

  /**
   * Alarm handler for cleanup
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    
    if (now - this.roomState.lastActivity > ROOM_TIMEOUT_MS) {
      // Room has been inactive, clean up
      if (this.roomState.host) {
        this.roomState.host.close(1000, 'Room timeout');
        this.roomState.host = null;
      }
      if (this.roomState.guest) {
        this.roomState.guest.close(1000, 'Room timeout');
        this.roomState.guest = null;
      }
    }
  }
}
