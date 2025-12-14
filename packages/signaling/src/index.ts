/**
 * PVP Games Signaling Worker
 *
 * Cloudflare Worker with Durable Object for real-time game room management.
 * Features:
 * - WebRTC signaling (offer/answer/ICE exchange)
 * - WebSocket relay fallback
 * - Hibernation API for cost efficiency
 * - Location hints for optimal latency
 */

export interface Env {
  ROOM: DurableObjectNamespace;
}

// ICE server configuration type (mirrors browser RTCIceServer)
interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// TURN server configuration (optional, set via environment)
const TURN_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Add TURN servers here if needed for NAT traversal
  // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' },
];

// Map Cloudflare colo codes to supported DurableObjectLocationHint values
// See: https://developers.cloudflare.com/durable-objects/reference/data-location/
const COLO_TO_HINT: Record<string, DurableObjectLocationHint> = {
  // Western North America
  LAX: 'wnam',
  SJC: 'wnam',
  SEA: 'wnam',
  PDX: 'wnam',
  SFO: 'wnam',
  PHX: 'wnam',
  DEN: 'wnam',
  LAS: 'wnam',
  // Eastern North America
  EWR: 'enam',
  IAD: 'enam',
  ATL: 'enam',
  MIA: 'enam',
  ORD: 'enam',
  DFW: 'enam',
  BOS: 'enam',
  CLT: 'enam',
  YYZ: 'enam',
  YUL: 'enam',
  // Western Europe
  LHR: 'weur',
  CDG: 'weur',
  AMS: 'weur',
  FRA: 'weur',
  MAD: 'weur',
  MXP: 'weur',
  ZRH: 'weur',
  BRU: 'weur',
  DUB: 'weur',
  MAN: 'weur',
  ARN: 'weur',
  CPH: 'weur',
  OSL: 'weur',
  HEL: 'weur',
  VIE: 'weur',
  WAW: 'weur',
  // Eastern Europe
  KBP: 'eeur',
  SOF: 'eeur',
  OTP: 'eeur',
  BUD: 'eeur',
  PRG: 'eeur',
  // Asia Pacific
  NRT: 'apac',
  HND: 'apac',
  HKG: 'apac',
  SIN: 'apac',
  ICN: 'apac',
  TPE: 'apac',
  BKK: 'apac',
  KUL: 'apac',
  SYD: 'apac',
  MEL: 'apac',
  BOM: 'apac',
  DEL: 'apac',
  MAA: 'apac',
  CGK: 'apac',
  MNL: 'apac',
  // South America
  GRU: 'sam',
  GIG: 'sam',
  EZE: 'sam',
  SCL: 'sam',
  BOG: 'sam',
  LIM: 'sam',
  // Africa
  JNB: 'afr',
  CPT: 'afr',
  LOS: 'afr',
  NBO: 'afr',
  CAI: 'afr',
  // Middle East
  DXB: 'me',
  DOH: 'me',
  TLV: 'me',
  BAH: 'me',
  KWI: 'me',
  // Oceania (map to apac)
  AKL: 'apac',
  PER: 'apac',
  BNE: 'apac',
};

/**
 * Map a Cloudflare colo code to a supported DurableObjectLocationHint
 * Returns undefined if the colo is not recognized (DO will use default placement)
 */
function mapColoToLocationHint(colo: string | undefined): DurableObjectLocationHint | undefined {
  if (!colo) return undefined;
  return COLO_TO_HINT[colo.toUpperCase()];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '2.0' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ICE servers endpoint - client fetches this to get TURN/STUN config
    if (url.pathname === '/ice-servers') {
      return new Response(JSON.stringify({ iceServers: TURN_SERVERS }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // WebSocket connection
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room');
      const role = url.searchParams.get('role');

      if (!roomId || !role) {
        return new Response('Missing room or role parameter', {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Get or create the Durable Object for this room
      const id = env.ROOM.idFromName(roomId);

      // Use locationHint to place DO near the host (room creator)
      // Only apply hint for host (first connection), map colo to supported region
      let room: DurableObjectStub;
      if (role === 'host') {
        const hint = mapColoToLocationHint(request.cf?.colo as string | undefined);
        room = hint ? env.ROOM.get(id, { locationHint: hint }) : env.ROOM.get(id);
      } else {
        room = env.ROOM.get(id);
      }

      // Forward the request to the Durable Object
      return room.fetch(request);
    }

    // Room info API
    if (url.pathname.startsWith('/api/room/') && request.method === 'GET') {
      const roomId = url.pathname.split('/').pop();
      if (!roomId) {
        return new Response('Missing room ID', { status: 400, headers: corsHeaders });
      }

      const id = env.ROOM.idFromName(roomId);
      const room = env.ROOM.get(id);

      // Forward to DO for info
      const infoUrl = new URL(request.url);
      infoUrl.pathname = '/info';
      return room.fetch(new Request(infoUrl.toString(), { method: 'GET' }));
    }

    // Default response
    return new Response(
      'PVP Games Signaling Server v2.0\n\n' +
        'Endpoints:\n' +
        '- GET /health - Health check\n' +
        '- GET /ice-servers - Get TURN/STUN configuration\n' +
        '- GET /api/room/:id - Room info\n' +
        '- WS /ws?room=:id&role=host|guest - WebSocket connection\n\n' +
        'Features:\n' +
        '- WebRTC signaling for P2P connections\n' +
        '- WebSocket relay fallback\n' +
        '- Hibernation API for efficiency\n' +
        '- Location-aware DO placement',
      { headers: { 'Content-Type': 'text/plain', ...corsHeaders } },
    );
  },
};

// ICE candidate type (mirrors browser RTCIceCandidateInit)
interface IceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

// Message types
type SignalingMessage =
  | { type: 'joined'; role: 'host' | 'guest' }
  | { type: 'room-ready'; iceServers: IceServer[] }
  | { type: 'leave'; role: 'host' | 'guest' }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: IceCandidateInit }
  | { type: 'webrtc-ready' }
  | { type: 'webrtc-failed' }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'game'; payload: unknown };

/**
 * GameRoom Durable Object with Hibernation API
 *
 * Uses WebSocket Hibernation to reduce costs when connections are idle.
 * Supports both WebRTC signaling and WebSocket relay.
 */
export class GameRoom {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, { role: 'host' | 'guest'; webrtcReady: boolean }> = new Map();
  private createdAt: number = 0;
  private lastActivity: number = 0;
  private webrtcEstablished = false;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;

    // Restore state from storage if hibernated
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<{
        createdAt: number;
        lastActivity: number;
        webrtcEstablished: boolean;
      }>('roomState');
      if (stored) {
        this.createdAt = stored.createdAt;
        this.lastActivity = stored.lastActivity;
        this.webrtcEstablished = stored.webrtcEstablished;
      } else {
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
      }

      // Restore WebSocket sessions from hibernation
      for (const ws of this.state.getWebSockets()) {
        const tags = this.state.getTags(ws);
        const role = tags.find((t) => t === 'host' || t === 'guest') as 'host' | 'guest' | undefined;
        if (role) {
          this.sessions.set(ws, { role, webrtcReady: false });
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Room info endpoint
    if (url.pathname === '/info') {
      const hostWs = this.getWebSocketByRole('host');
      const guestWs = this.getWebSocketByRole('guest');

      return new Response(
        JSON.stringify({
          hasHost: !!hostWs,
          hasGuest: !!guestWs,
          webrtcEstablished: this.webrtcEstablished,
          createdAt: this.createdAt,
          lastActivity: this.lastActivity,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const role = url.searchParams.get('role') as 'host' | 'guest' | null;
    if (!role || (role !== 'host' && role !== 'guest')) {
      return new Response('Invalid role', { status: 400 });
    }

    // Check if slot is available
    const existingWs = this.getWebSocketByRole(role);
    if (existingWs) {
      return new Response(`${role} slot already taken`, { status: 409 });
    }

    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Accept with Hibernation API - use tags to store role
    this.state.acceptWebSocket(server, [role]);
    this.sessions.set(server, { role, webrtcReady: false });

    this.lastActivity = Date.now();
    await this.saveState();

    // Send join confirmation
    server.send(JSON.stringify({ type: 'joined', role }));

    // Check if room is ready (both peers connected)
    const hostWs = this.getWebSocketByRole('host');
    const guestWs = this.getWebSocketByRole('guest');

    if (hostWs && guestWs) {
      // Room is ready - send ready message with ICE servers
      const readyMessage: SignalingMessage = {
        type: 'room-ready',
        iceServers: TURN_SERVERS,
      };
      const readyJson = JSON.stringify(readyMessage);
      hostWs.send(readyJson);
      guestWs.send(readyJson);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Hibernation API handler - called when WebSocket receives a message
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    this.lastActivity = Date.now();

    try {
      const data = JSON.parse(message) as SignalingMessage;
      const session = this.sessions.get(ws);
      if (!session) return;

      const role = session.role;
      const otherWs = this.getWebSocketByRole(role === 'host' ? 'guest' : 'host');

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Forward WebRTC signaling to other peer
          if (otherWs) {
            otherWs.send(message);
          }
          break;

        case 'webrtc-ready':
          // Mark this peer as WebRTC ready
          session.webrtcReady = true;

          // Check if both peers are WebRTC ready
          const hostSession = this.getSessionByRole('host');
          const guestSession = this.getSessionByRole('guest');
          if (hostSession?.webrtcReady && guestSession?.webrtcReady) {
            this.webrtcEstablished = true;
            await this.saveState();
          }
          break;

        case 'webrtc-failed':
          // WebRTC failed, will continue using WebSocket relay
          console.log(`WebRTC failed for ${role}, using WebSocket relay`);
          break;

        case 'game':
          // Game message - forward to other peer (WebSocket relay)
          // Only relay if WebRTC is not established
          if (!this.webrtcEstablished && otherWs) {
            otherWs.send(message);
          }
          break;

        default:
          // Forward unknown messages to other peer
          if (otherWs) {
            otherWs.send(message);
          }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // Hibernation API handler - called when WebSocket closes
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    const role = session.role;
    this.sessions.delete(ws);

    // Reset WebRTC state if a peer disconnects
    this.webrtcEstablished = false;

    // Notify other peer
    const otherWs = this.getWebSocketByRole(role === 'host' ? 'guest' : 'host');
    if (otherWs) {
      otherWs.send(JSON.stringify({ type: 'leave', role }));
    }

    this.lastActivity = Date.now();
    await this.saveState();
  }

  // Hibernation API handler - called when WebSocket errors
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  private getWebSocketByRole(role: 'host' | 'guest'): WebSocket | undefined {
    for (const [ws, session] of this.sessions) {
      if (session.role === role) {
        return ws;
      }
    }
    return undefined;
  }

  private getSessionByRole(role: 'host' | 'guest') {
    for (const [, session] of this.sessions) {
      if (session.role === role) {
        return session;
      }
    }
    return undefined;
  }

  private async saveState(): Promise<void> {
    await this.state.storage.put('roomState', {
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      webrtcEstablished: this.webrtcEstablished,
    });
  }
}
