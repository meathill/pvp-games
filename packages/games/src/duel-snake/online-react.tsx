'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Direction, DuelSnakeState, PlayerId } from './engine';
import { DuelSnakeOnlineHost, DuelSnakeOnlineClient } from './online';
import type { PeerRole } from '@pvp-games/shared';

// Game rendering constants
const CELL_SIZE = 18;
const CELL_GAP = 2;

// Network constants
const TICK_INTERVAL_MS = 120;

export const PLAYER_COLORS: Record<PlayerId, { primary: string; stroke: string; light: string; text: string }> = {
  p1: {
    primary: '#34d399',
    stroke: 'rgba(110, 231, 183, 0.7)',
    light: '#ecfdf3',
    text: '#065f46',
  },
  p2: {
    primary: '#38bdf8',
    stroke: 'rgba(125, 211, 252, 0.7)',
    light: '#f0f9ff',
    text: '#0ea5e9',
  },
};

import { HybridTransport, type ConnectionStatus, type TransportType } from './hybrid-transport';

export interface DuelSnakeOnlineProps {
  serverUrl: string;
  roomId: string;
  role: PeerRole;
  onLeave?: () => void;
}

export function DuelSnakeOnline({ serverUrl, roomId, role, onLeave }: DuelSnakeOnlineProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DuelSnakeState | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [transport, setTransport] = useState<TransportType>('websocket');

  const transportRef = useRef<HybridTransport | null>(null);
  const hostRef = useRef<DuelSnakeOnlineHost | null>(null);
  const clientRef = useRef<DuelSnakeOnlineClient | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);

  // Connect to room
  useEffect(() => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    const endpoint = new HybridTransport(role, serverUrl, roomId, setStatus, setError, setTransport, setLatency);
    transportRef.current = endpoint;

    endpoint.connect().catch((err) => {
      setError(err.message || '连接失败');
      setStatus('error');
    });

    return () => {
      isConnectingRef.current = false;
      endpoint.dispose();
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
      hostRef.current?.dispose();
      clientRef.current?.dispose();
    };
  }, [serverUrl, roomId, role]);

  // Initialize game when ready
  useEffect(() => {
    if (status !== 'ready') return;

    const endpoint = transportRef.current;
    if (!endpoint) return;

    if (role === 'host') {
      const host = new DuelSnakeOnlineHost({
        channel: endpoint,
        seed: `${roomId}-${Date.now()}`,
        tickIntervalMs: TICK_INTERVAL_MS,
        onStateChange: (newState) => {
          setState(newState);
          if (newState.status === 'running') {
            setStatus('playing');
          }
        },
        onError: (err) => setError(err.message),
      });
      hostRef.current = host;
      setState(host.getState());
      host.markReady();
    } else {
      const client = new DuelSnakeOnlineClient({
        channel: endpoint,
        onStateChange: (newState) => {
          setState(newState);
          if (newState.status === 'running') {
            setStatus('playing');
          }
        },
        onLatencyUpdate: (l) => {
          // Combine transport latency with game latency
          setLatency((endpoint.latency + l) / 2);
        },
        onError: (err) => setError(err.message),
      });
      clientRef.current = client;
      client.markReady();
    }
  }, [status, role, roomId]);

  // Tick loop for host
  useEffect(() => {
    if (status !== 'playing' || role !== 'host') return;

    const host = hostRef.current;
    if (!host) return;

    tickIntervalRef.current = window.setInterval(() => {
      host.tick();
    }, TICK_INTERVAL_MS);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [status, role]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };

      const direction = keyMap[event.key.toLowerCase()];
      if (!direction) return;

      event.preventDefault();

      if (role === 'host' && hostRef.current) {
        hostRef.current.queueInput(direction);
      } else if (role === 'guest' && clientRef.current) {
        clientRef.current.sendInput(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [role]);

  const handleLeave = useCallback(() => {
    transportRef.current?.dispose();
    onLeave?.();
  }, [onLeave]);

  const statusText = useMemo(() => {
    switch (status) {
      case 'disconnected':
        return '已断开连接';
      case 'connecting':
        return '正在连接服务器...';
      case 'waiting':
        return role === 'host' ? '等待对手加入...' : '正在加入房间...';
      case 'signaling':
        return '正在建立 P2P 连接...';
      case 'ready':
        return '准备开始...';
      case 'playing':
        if (state?.status === 'finished') {
          return state.winner ? `游戏结束：${state.winner === 'p1' ? '主机' : '访客'}获胜！` : '游戏结束';
        }
        return '游戏进行中';
      case 'error':
        return '连接错误';
      default:
        return '';
    }
  }, [status, state, role]);

  const transportLabel = transport === 'webrtc' ? 'P2P' : '中继';

  // Waiting screen
  if (status !== 'playing' || !state) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl bg-white/80 p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-50 px-4">{statusText}</div>

        {status === 'waiting' && role === 'host' && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-slate-600 dark:text-slate-300">分享此房间码给你的对手：</div>
            <div className="rounded-lg bg-slate-100 px-4 py-2 font-mono text-2xl font-bold text-slate-900 dark:bg-slate-700 dark:text-slate-50">
              {roomId}
            </div>
          </div>
        )}

        {status === 'signaling' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            正在尝试建立点对点连接，如失败将使用服务器中继...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleLeave}
          className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
          离开房间
        </button>
      </div>
    );
  }

  // Game board
  const width = state.dimensions.width;
  const height = state.dimensions.height;
  const p1Cells = new Set(state.players.p1.segments.map((cell) => `${cell.x},${cell.y}`));
  const p2Cells = new Set(state.players.p2.segments.map((cell) => `${cell.x},${cell.y}`));
  const fruitKey = `${state.fruit.x},${state.fruit.y}`;
  const myPlayer = role === 'host' ? 'p1' : 'p2';
  const opponentPlayer = role === 'host' ? 'p2' : 'p1';

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/80 px-5 py-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{statusText}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span
              className={`inline-block h-2 w-2 rounded-full ${transport === 'webrtc' ? 'bg-green-500' : 'bg-yellow-500'}`}
            />
            <span>{transportLabel}</span>
            {latency > 0 && <span>· {Math.round(latency)}ms</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLeave}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          离开
        </button>
      </div>

      {/* Score panel */}
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-white/80 px-5 py-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: PLAYER_COLORS[myPlayer].light,
            color: PLAYER_COLORS[myPlayer].text,
            boxShadow: `0 0 0 1px ${PLAYER_COLORS[myPlayer].stroke}`,
          }}>
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: PLAYER_COLORS[myPlayer].primary }}
          />
          <span className="font-semibold">你: {state.players[myPlayer].score}</span>
        </div>
        <div className="text-slate-400">vs</div>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: PLAYER_COLORS[opponentPlayer].light,
            color: PLAYER_COLORS[opponentPlayer].text,
            boxShadow: `0 0 0 1px ${PLAYER_COLORS[opponentPlayer].stroke}`,
          }}>
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: PLAYER_COLORS[opponentPlayer].primary }}
          />
          <span className="font-semibold">对手: {state.players[opponentPlayer].score}</span>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">目标: {state.targetScore}</div>
      </div>

      {/* Game board */}
      <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
        <div
          className="grid rounded-xl bg-slate-100 p-2 shadow-inner ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          style={{
            gridTemplateColumns: `repeat(${width}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${height}, ${CELL_SIZE}px)`,
            gap: `${CELL_GAP}px`,
          }}>
          {Array.from({ length: height * width }).map((_, index) => {
            const x = index % width;
            const y = Math.floor(index / width);
            const key = `${x},${y}`;
            const isP1 = p1Cells.has(key);
            const isP2 = p2Cells.has(key);
            const isFruit = key === fruitKey;

            const fillStyle = (() => {
              if (isFruit) {
                return { backgroundColor: '#f97316', boxShadow: '0 0 0 1px rgba(251, 146, 60, 0.7)' };
              }
              if (isP1) {
                return {
                  backgroundColor: PLAYER_COLORS.p1.primary,
                  boxShadow: `0 0 0 1px ${PLAYER_COLORS.p1.stroke}`,
                };
              }
              if (isP2) {
                return {
                  backgroundColor: PLAYER_COLORS.p2.primary,
                  boxShadow: `0 0 0 1px ${PLAYER_COLORS.p2.stroke}`,
                };
              }
              return undefined;
            })();

            return (
              <div
                key={key}
                className="h-[18px] w-[18px] rounded-sm bg-slate-200 ring-1 ring-slate-200 transition-colors duration-75 dark:bg-slate-700 dark:ring-slate-600"
                style={fillStyle}
              />
            );
          })}
        </div>
      </div>

      {/* Controls hint */}
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">使用方向键或 WASD 控制</div>
    </div>
  );
}

export default DuelSnakeOnline;
