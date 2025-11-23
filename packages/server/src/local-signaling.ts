/**
 * Simple WebSocket signaling server for local LAN testing
 * 
 * Run with: npx tsx packages/server/src/local-signaling.ts
 * 
 * This creates a minimal WebSocket server that:
 * - Manages rooms with host/guest slots
 * - Forwards signaling messages (offer/answer/ICE)
 * - Relays game messages when WebRTC fallback is needed
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '8787', 10);

interface Room {
  id: string;
  host: WebSocket | null;
  guest: WebSocket | null;
  createdAt: number;
}

const rooms = new Map<string, Room>();

// Create HTTP server
const server = createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Room creation endpoint
  if (url.pathname === '/api/room' && req.method === 'POST') {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      id: roomId,
      host: null,
      guest: null,
      createdAt: Date.now()
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roomId }));
    console.log(`[Room] Created: ${roomId}`);
    return;
  }

  // Room info endpoint
  if (url.pathname.startsWith('/api/room/') && req.method === 'GET') {
    const roomId = url.pathname.split('/').pop();
    const room = rooms.get(roomId || '');

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: room.id,
      hasHost: !!room.host,
      hasGuest: !!room.guest
    }));
    return;
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    return;
  }

  // Default response
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('PVP Games Signaling Server\n\nEndpoints:\n- POST /api/room - Create room\n- GET /api/room/:id - Room info\n- WS /ws?room=:id&role=host|guest - WebSocket connection');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const roomId = url.searchParams.get('room');
  const role = url.searchParams.get('role') as 'host' | 'guest' | null;

  if (!roomId || !role || (role !== 'host' && role !== 'guest')) {
    ws.close(4000, 'Missing room or role parameter');
    return;
  }

  // Auto-create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      host: null,
      guest: null,
      createdAt: Date.now()
    });
    console.log(`[Room] Auto-created: ${roomId}`);
  }

  const room = rooms.get(roomId)!;

  // Check if slot is available
  if (role === 'host' && room.host) {
    ws.close(4001, 'Host slot already taken');
    return;
  }
  if (role === 'guest' && room.guest) {
    ws.close(4002, 'Guest slot already taken');
    return;
  }

  // Assign to slot
  if (role === 'host') {
    room.host = ws;
  } else {
    room.guest = ws;
  }

  console.log(`[Room ${roomId}] ${role} joined`);

  // Send join confirmation
  ws.send(JSON.stringify({ type: 'joined', role, roomId }));

  // Check if room is ready (both peers connected)
  if (room.host && room.guest) {
    const readyMessage = JSON.stringify({ type: 'room-ready' });
    room.host.send(readyMessage);
    room.guest.send(readyMessage);
    console.log(`[Room ${roomId}] Both peers connected, room ready`);
  }

  // Handle messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const otherPeer = role === 'host' ? room.guest : room.host;

      // Log message type
      console.log(`[Room ${roomId}] ${role} -> ${message.type}`);

      // Handle ping/pong locally
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Forward all other messages to the other peer
      if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
        otherPeer.send(data.toString());
      }
    } catch (error) {
      console.error(`[Room ${roomId}] Error parsing message:`, error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log(`[Room ${roomId}] ${role} disconnected`);

    if (role === 'host') {
      room.host = null;
    } else {
      room.guest = null;
    }

    // Notify other peer
    const otherPeer = role === 'host' ? room.guest : room.host;
    if (otherPeer && otherPeer.readyState === WebSocket.OPEN) {
      otherPeer.send(JSON.stringify({ type: 'leave', role }));
    }

    // Clean up empty rooms after a delay
    setTimeout(() => {
      const currentRoom = rooms.get(roomId);
      if (currentRoom && !currentRoom.host && !currentRoom.guest) {
        rooms.delete(roomId);
        console.log(`[Room] Deleted empty room: ${roomId}`);
      }
    }, 60000); // 1 minute
  });

  ws.on('error', (error) => {
    console.error(`[Room ${roomId}] ${role} error:`, error);
  });
});

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 PVP Games Signaling Server running on port ${PORT}`);
  console.log(`\n   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://<your-lan-ip>:${PORT}`);
  console.log(`\n   WebSocket: ws://localhost:${PORT}/ws?room=ROOMID&role=host|guest`);
  console.log('\nPress Ctrl+C to stop\n');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  server.close();
  process.exit(0);
});
