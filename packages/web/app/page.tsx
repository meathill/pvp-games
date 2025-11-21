import React from 'react';
import { DuelSnakeExperience, getGameSummaries } from '@pvp-games/games';

const hallHighlights = [
  {
    title: '零等待开局',
    description: '无需下载，浏览器即可进入本地或在线对战。'
  },
  {
    title: '每日推荐',
    description: '根据游玩反馈轮换首页展示，让大厅保持新鲜。'
  },
  {
    title: '共享引擎',
    description: '核心玩法托管在 @pvp-games/games，前端按需加载。'
  }
];

const sidebarNotices = [
  {
    title: '周末蛇蛇积分赛',
    description: '限定 10 回合，累计水果数排行，上榜即展示。',
    tone: '活动'
  },
  {
    title: '云对战大厅预告',
    description: 'Sky Pong 与 Grid Rush 将接入匹配与观战。',
    tone: '预告'
  },
  {
    title: '征集玩法与素材',
    description: '欢迎提交 Issue/PR，扩展地图皮肤或联机模式。',
    tone: '社区'
  }
];

const games = getGameSummaries();

export default function HomePage() {
  const duelSnake = games.find((game) => game.id === 'duel-snake') ?? games[ 0 ];

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-800 text-white shadow-2xl ring-1 ring-slate-800/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(125,211,252,0.18),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.2),transparent_36%)]" />
        <div className="relative grid gap-8 p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-100">PVP GAME HUB</p>
            <h1 className="text-4xl font-bold leading-tight">PVP 游戏大厅</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-100/90">
              精选轻量级 PVP 小游戏，覆盖本地、局域网与在线匹配。Next.js 负责渲染与 SEO，
              具体玩法通过 <code className="rounded bg-white/10 px-1 py-[2px] font-mono text-sm text-sky-100 ring-1 ring-white/20">@pvp-games/games</code>{' '}
              提供的组件加载，前端只做大厅编排。
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1 font-medium ring-1 ring-white/30">今日推荐 · {duelSnake?.title ?? '精选游戏'}</span>
              <span className="rounded-full bg-white/5 px-3 py-1 font-medium ring-1 ring-white/20">共 {games.length} 款上架</span>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 font-medium text-sky-50 ring-1 ring-sky-200/50">每日更新</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {hallHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner backdrop-blur"
                >
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-white/80">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg ring-1 ring-white/60 transition hover:-translate-y-[1px] hover:shadow-xl"
              >
                立即开局
              </button>
              <button
                type="button"
                className="rounded-full bg-transparent px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:-translate-y-[1px] hover:bg-white/10"
              >
                查看全部游戏
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 shadow-lg ring-1 ring-white/20 backdrop-blur">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-100">今日推荐</p>
                <h2 className="text-xl font-semibold text-white">{duelSnake?.title ?? '今日推荐游戏'}</h2>
                <p className="text-sm text-white/80">{duelSnake?.description ?? '本地双人对战，开局即战。'}</p>
              </div>
              <span className="rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-white/15">
                from games package
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl bg-slate-950/40 ring-1 ring-white/10">
              <DuelSnakeExperience />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-sky-600">上架游戏</p>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">所有游戏与模式</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">统一入口，支持搜索引擎收录的大厅列表。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              持续更新
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {games.map((game) => (
              <article
                key={game.id}
                className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{game.title}</h3>
                      {game.description && <p className="text-sm text-slate-600 dark:text-slate-300">{game.description}</p>}
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                      PVP
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(game.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-sky-600">活动 & 公告</p>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">大厅播报</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">每日刷新一条活动或联机实验，便于 SEO 抓取。</p>
          </div>
          <div className="space-y-3">
            {sidebarNotices.map((notice) => (
              <div
                key={notice.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-50">{notice.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{notice.description}</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/60 dark:text-sky-100 dark:ring-sky-800">
                    {notice.tone}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
