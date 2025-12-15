import React from 'react';
import Link from 'next/link';

import { hallHighlights, pickFeaturedGame, sidebarNotices } from './data/home';
import { listGameCatalog } from './data/games';

const games = listGameCatalog();

export default function HomePage() {
  const featuredGame = pickFeaturedGame(games);
  const localGame = games.find((g) => g.id === 'duel-snake');

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.3),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(14,165,233,0.25),transparent_45%)]" />
        <div className="relative p-8 lg:p-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">PVP Game Hub</p>
              <h1 className="text-4xl font-bold leading-tight lg:text-5xl">PVP 游戏大厅</h1>
              <p className="max-w-xl text-lg text-slate-200/90">轻量级在线 PVP 小游戏，浏览器即开即玩。</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-green-500/20 px-4 py-1.5 text-sm font-medium text-green-200 ring-1 ring-green-400/30">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                在线可用
              </span>
              <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium ring-1 ring-white/20">
                WebRTC P2P
              </span>
              <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium ring-1 ring-white/20">
                低延迟直连
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Game - 大卡片突出展示 */}
      {featuredGame && (
        <section className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 p-px shadow-xl transition-all hover:shadow-2xl">
          <div className="relative rounded-[15px] bg-gradient-to-br from-sky-500/90 via-sky-600/95 to-blue-700 p-6 lg:p-8">
            <div className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
              推荐
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white lg:text-3xl">{featuredGame.title}</h2>
                  <p className="max-w-lg text-base text-white/90">{featuredGame.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(featuredGame.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href={`/games/${featuredGame.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-sky-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    立即开始对战
                  </Link>
                  <span className="text-sm text-white/70">邀请好友，在线对战</span>
                </div>
              </div>

              <div className="hidden items-center lg:flex">
                <div className="grid h-32 w-32 place-items-center rounded-2xl bg-white/10 backdrop-blur">
                  <svg
                    className="h-16 w-16 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 内容区域 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 更多游戏 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">更多玩法</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">共 {games.length} 款游戏</span>
          </div>

          <div className="space-y-3">
            {/* 本地版本 - 次要展示 */}
            {localGame && (
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{localGame.title}</h3>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        本地
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{localGame.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {(localGame.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`/games/${localGame.id}`}
                    className="shrink-0 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                    进入游戏
                  </Link>
                </div>
              </article>
            )}

            {/* 敬请期待 */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">更多游戏开发中...</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">敬请期待 Sky Pong、Grid Rush 等新游戏</p>
              </div>
            </div>
          </div>
        </section>

        {/* 侧边栏 */}
        <aside className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">公告</h3>
          <div className="space-y-3">
            {sidebarNotices.map((notice) => (
              <div
                key={notice.title}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-white">{notice.title}</p>
                    <span className="shrink-0 rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                      {notice.tone}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{notice.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 功能亮点 */}
          <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 p-4 dark:from-slate-800 dark:to-slate-800/50">
            <h4 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-300">平台特色</h4>
            <div className="space-y-2">
              {hallHighlights.slice(0, 2).map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
