import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PVP 游戏大厅',
  description: 'PVP 对战游戏合集与每日推荐。'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">{children}</body>
    </html>
  );
}
