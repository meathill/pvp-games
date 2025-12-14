import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

export const metadata: Metadata = {
  title: 'PVP 游戏大厅',
  description: 'PVP 对战游戏合集与每日推荐。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="shortcut icon"
          href="/favicon.png"
          type="image/png"
        />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
