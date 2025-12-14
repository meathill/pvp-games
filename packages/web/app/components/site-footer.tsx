import React from 'react';
import Link from 'next/link';

import type { NavLink } from '../data/site';
import { footerLinks } from '../data/site';

function FooterLink({ link }: { link: NavLink }) {
  const className =
    'rounded-full px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white';

  if (link.external) {
    return (
      <a
        key={link.label}
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
      key={link.label}
      href={link.href}
      className={className}>
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">PVP 游戏大厅</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">精选对战玩法，跨平台轻量体验。</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">© {new Date().getFullYear()} PVP Game Hub</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {footerLinks.map((link) => (
            <FooterLink
              key={link.label}
              link={link}
            />
          ))}
        </div>
      </div>
    </footer>
  );
}
