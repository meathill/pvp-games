'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { PeerRole } from '@pvp-games/shared';

// Dynamic import to avoid SSR issues with WebSocket
const DuelSnakeOnline = dynamic(() => import('@pvp-games/games').then((mod) => mod.DuelSnakeOnline), {
  ssr: false,
  loading: () => <LoadingState />,
});

function LoadingState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-2xl bg-white/80 p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
      <div className="text-lg font-medium text-slate-600 dark:text-slate-300">正在加载...</div>
    </div>
  );
}

type PageState = 'menu' | 'creating' | 'joining' | 'playing';

// Default to localhost for local development
const DEFAULT_SERVER_URL =
  typeof window !== 'undefined' ? `ws://${window.location.hostname}:8787/ws` : 'ws://localhost:8787/ws';

export default function DuelSnakeOnlinePage() {
  const [pageState, setPageState] = useState<PageState>('menu');
  const [roomId, setRoomId] = useState<string>('');
  const [role, setRole] = useState<PeerRole>('host');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = useCallback(async () => {
    setError(null);
    setPageState('creating');

    try {
      // Generate a simple room ID
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let newRoomId = '';
      for (let i = 0; i < 6; i++) {
        newRoomId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      setRoomId(newRoomId);
      setRole('host');
      setPageState('playing');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建房间失败');
      setPageState('menu');
    }
  }, []);

  const handleJoinRoom = useCallback(() => {
    if (!joinRoomId.trim()) {
      setError('请输入房间码');
      return;
    }

    setError(null);
    setRoomId(joinRoomId.trim().toUpperCase());
    setRole('guest');
    setPageState('playing');
  }, [joinRoomId]);

  const handleLeave = useCallback(() => {
    setPageState('menu');
    setRoomId('');
    setJoinRoomId('');
    setError(null);
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-sky-600">在线对战</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">贪吃蛇 PVP</h1>
          <p className="max-w-3xl text-base text-slate-600 dark:text-slate-300">
            与朋友进行在线对战，先吃到 10 分的玩家获胜！
          </p>
        </div>
        <Link
          href="/games/duel-snake"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:border-sky-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          返回本地模式
        </Link>
      </div>

      {pageState === 'menu' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Room */}
            <div className="space-y-4 rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">创建房间</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">创建一个新房间，等待朋友加入</p>
              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500">
                创建房间
              </button>
            </div>

            {/* Join Room */}
            <div className="space-y-4 rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">加入房间</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">输入朋友分享的房间码</p>
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                placeholder="输入房间码"
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-center font-mono text-lg uppercase tracking-wider text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleJoinRoom}
                disabled={!joinRoomId.trim()}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                加入房间
              </button>
            </div>
          </div>

          {/* Server URL config (for LAN testing) */}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
              高级设置
            </summary>
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">信令服务器地址</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="ws://localhost:8787/ws"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                局域网测试时，请将 localhost 替换为服务器的 IP 地址
              </p>
            </div>
          </details>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      {pageState === 'playing' && roomId && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <DuelSnakeOnline
            serverUrl={serverUrl}
            roomId={roomId}
            role={role}
            onLeave={handleLeave}
          />
        </section>
      )}

      {/* Instructions */}
      <div className="rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-50">如何进行局域网联机测试</h3>
        <ol className="list-inside list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>
            在终端运行信令服务器：
            <code className="ml-2 rounded bg-slate-200 px-2 py-1 font-mono text-xs dark:bg-slate-700">
              pnpm -C packages/server dev
            </code>
          </li>
          <li>
            在另一个终端运行前端：
            <code className="ml-2 rounded bg-slate-200 px-2 py-1 font-mono text-xs dark:bg-slate-700">
              pnpm -C packages/web dev
            </code>
          </li>
          <li>主机玩家点击"创建房间"，记下房间码</li>
          <li>访客玩家在"高级设置"中填入主机的 IP 地址，然后输入房间码加入</li>
          <li>两人都准备好后游戏自动开始</li>
        </ol>
      </div>
    </main>
  );
}
