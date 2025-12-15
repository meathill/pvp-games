'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Direction, DuelSnakeState, PlayerId } from './engine';
import { DuelSnakeOnlineHost, DuelSnakeOnlineClient } from './online';
import type { PeerRole } from '@pvp-games/shared';
import { PLAYER_COLORS } from './constants';
import { GameBoard } from './game-board';
import { HybridTransport, type ConnectionStatus, type TransportType } from './hybrid-transport';

// Network constants
const TICK_INTERVAL_MS = 120;

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
  const [startConfirmed, setStartConfirmed] = useState(false);
  const [opponentConfirmed, setOpponentConfirmed] = useState(false);

  const transportRef = useRef<HybridTransport | null>(null);
  const hostRef = useRef<DuelSnakeOnlineHost | null>(null);
  const clientRef = useRef<DuelSnakeOnlineClient | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  const gameInitializedRef = useRef(false);

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

  // Initialize game when ready (but don't mark ready until user confirms)
  useEffect(() => {
    if (status !== 'ready') return;
    if (gameInitializedRef.current) return;

    const endpoint = transportRef.current;
    if (!endpoint) return;

    gameInitializedRef.current = true;

    if (role === 'host') {
      const host = new DuelSnakeOnlineHost({
        channel: endpoint,
        seed: `${roomId}-${Date.now()}`,
        tickIntervalMs: TICK_INTERVAL_MS,
        onStateChange: (newState) => {
          setState(newState);
          // 检查对方是否已确认
          if (newState.players.p2.ready) {
            setOpponentConfirmed(true);
          }
          if (newState.status === 'running') {
            setStatus('playing');
          }
        },
        onError: (err) => setError(err.message),
      });
      hostRef.current = host;
      setState(host.getState());
      // 不再自动调用 markReady，等待用户确认
    } else {
      const client = new DuelSnakeOnlineClient({
        channel: endpoint,
        onStateChange: (newState) => {
          setState(newState);
          // 检查对方是否已确认
          if (newState.players.p1.ready) {
            setOpponentConfirmed(true);
          }
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
      // 不再自动调用 markReady，等待用户确认
    }
  }, [status, role, roomId]);

  // 用户点击开始游戏按钮
  const handleStartConfirm = useCallback(() => {
    setStartConfirmed(true);
    if (role === 'host' && hostRef.current) {
      hostRef.current.markReady();
    } else if (role === 'guest' && clientRef.current) {
      clientRef.current.markReady();
    }
  }, [role]);

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
    const myPlayer = role === 'host' ? 'p1' : 'p2';

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

        {/* 开始确认面板 */}
        {status === 'ready' && (
          <div className="flex flex-col items-center gap-6 max-w-md">
            {/* 游戏规则说明 */}
            <div className="text-center space-y-2">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">贪吃蛇对战</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                使用方向键或 WASD 控制你的蛇移动。吃到水果可以得分并让蛇变长。 先到达 {state?.targetScore ?? 10}{' '}
                分的玩家获胜！
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                撞到墙壁或对方的身体会导致死亡，死亡后会在随机位置重生，但分数会清零。
              </p>
            </div>

            {/* 玩家颜色指示 */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  backgroundColor: PLAYER_COLORS[myPlayer].light,
                  color: PLAYER_COLORS[myPlayer].text,
                  boxShadow: `0 0 0 1px ${PLAYER_COLORS[myPlayer].stroke}`,
                }}>
                <span
                  className="h-4 w-4 rounded-sm"
                  style={{ backgroundColor: PLAYER_COLORS[myPlayer].primary }}
                />
                <span className="font-semibold">你的颜色</span>
              </div>
            </div>

            {/* 确认状态 */}
            <div className="flex items-center gap-4 text-sm">
              <div
                className={`flex items-center gap-2 ${startConfirmed ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${startConfirmed ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                />
                <span>你{startConfirmed ? '已准备' : '未准备'}</span>
              </div>
              <div
                className={`flex items-center gap-2 ${opponentConfirmed ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${opponentConfirmed ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                />
                <span>对手{opponentConfirmed ? '已准备' : '未准备'}</span>
              </div>
            </div>

            {/* 开始按钮 */}
            {!startConfirmed ? (
              <button
                type="button"
                onClick={handleStartConfirm}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-400">
                开始游戏
              </button>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {opponentConfirmed ? '游戏即将开始...' : '等待对手确认...'}
              </div>
            )}
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
      <GameBoard state={state} />

      {/* Controls hint */}
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">使用方向键或 WASD 控制</div>
    </div>
  );
}

export default DuelSnakeOnline;
