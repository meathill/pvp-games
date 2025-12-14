import React from 'react';
import Link from 'next/link';

import type { NavLink } from '../data/site';
import { siteNavLinks } from '../data/site';

function NavLinkItem({ link }: { link: NavLink }) {
  const className =
    'rounded-full px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900';

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <Link
      href={link.href}
      className={className}>
      {link.label}
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-sm dark:bg-slate-800 dark:text-slate-50 dark:ring-slate-700 dark:hover:bg-slate-700">
          <span className="rounded-full bg-sky-500/10 px-2 py-[6px] text-xs font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-200 group-hover:bg-sky-500/15 dark:bg-sky-900/40 dark:text-sky-100 dark:ring-sky-800">
            PVP
          </span>
          <span className="text-base">PVP 游戏大厅</span>
        </Link>
        <nav
          aria-label="主导航"
          className="flex flex-1 items-center justify-end gap-1">
          {siteNavLinks.map((link) => (
            <NavLinkItem
              key={link.label}
              link={link}
            />
          ))}
        </nav>
      </div>
    </header>
  );
}
