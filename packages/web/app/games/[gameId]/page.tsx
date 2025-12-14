import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DuelSnakeExperience } from '@pvp-games/games';

import { findGameBySlug, listGameCatalog } from '../../data/games';

const experienceRegistry: Record<string, React.ReactNode> = {
  'duel-snake': <DuelSnakeExperience />,
};

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export function generateStaticParams() {
  return listGameCatalog().map((game) => ({ gameId: game.slug }));
}

export const dynamicParams = false;

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params;
  const game = findGameBySlug(gameId);

  if (!game) {
    return notFound();
  }

  const experience = experienceRegistry[game.slug];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-sky-600">游戏详情</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{game.title}</h1>
          {game.description && (
            <p className="max-w-3xl text-base text-slate-600 dark:text-slate-300">{game.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(game.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:border-sky-200 hover:text-slate-900 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          返回大厅
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">玩法体验</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">具体对战体验在此页面加载，避免首页直接拉起。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            {game.id}
          </span>
        </div>
        {experience ?? (
          <p className="text-sm text-slate-600 dark:text-slate-300">该游戏的对战体验即将上线，敬请期待。</p>
        )}
      </section>
    </main>
  );
}
