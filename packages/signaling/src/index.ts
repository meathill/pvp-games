/**
 * PVP Games Signaling Worker
 *
 * Cloudflare Worker with Durable Object for real-time game room management.
 * Handles WebSocket connections for game signaling and message relay.
 */

export interface Env {
  ROOM: DurableObjectNamespace;
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
      return new Response(JSON.stringify({ status: 'ok' }), {
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
      const room = env.ROOM.get(id);

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
      'PVP Games Signaling Server\n\n' +
        'Endpoints:\n' +
        '- GET /health - Health check\n' +
        '- GET /api/room/:id - Room info\n' +
        '- WS /ws?room=:id&role=host|guest - WebSocket connection',
      { headers: { 'Content-Type': 'text/plain', ...corsHeaders } },
    );
  },
};

/**
 * GameRoom Durable Object
 *
 * Manages a single game room with two player slots (host/guest).
 */
export class GameRoom {
  private state: DurableObjectState;
  private host: WebSocket | null = null;
  private guest: WebSocket | null = null;
  private createdAt: number;
  private lastActivity: number;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Room info endpoint
    if (url.pathname === '/info') {
      return new Response(
        JSON.stringify({
          hasHost: !!this.host,
          hasGuest: !!this.guest,
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
    if (role === 'host' && this.host) {
      return new Response('Host slot already taken', { status: 409 });
    }
    if (role === 'guest' && this.guest) {
      return new Response('Guest slot already taken', { status: 409 });
    }

    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Accept the WebSocket
    this.state.acceptWebSocket(server, [role]);

    // Store connection
    if (role === 'host') {
      this.host = server;
    } else {
      this.guest = server;
    }

    this.lastActivity = Date.now();

    // Send join confirmation
    server.send(JSON.stringify({ type: 'joined', role }));

    // Check if room is ready
    if (this.host && this.guest) {
      const readyMessage = JSON.stringify({ type: 'room-ready' });
      this.host.send(readyMessage);
      this.guest.send(readyMessage);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    this.lastActivity = Date.now();

    try {
      const data = JSON.parse(message);
      const role = this.getRole(ws);
      const otherPeer = role === 'host' ? this.guest : this.host;

      // Handle ping locally
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Forward all other messages to other peer
      if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
        otherPeer.send(message);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const role = this.getRole(ws);

    if (role === 'host') {
      this.host = null;
    } else if (role === 'guest') {
      this.guest = null;
    }

    // Notify other peer
    const otherPeer = role === 'host' ? this.guest : this.host;
    if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
      otherPeer.send(JSON.stringify({ type: 'leave', role }));
    }

    this.lastActivity = Date.now();
  }

  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error('WebSocket error:', error);
  }

  private getRole(ws: WebSocket): 'host' | 'guest' | null {
    if (this.host === ws) return 'host';
    if (this.guest === ws) return 'guest';
    return null;
  }
}
