import type { Route } from 'next';

type ExternalLink = { label: string; href: string; external: true };
type InternalLink = { label: string; href: Route; external?: false };

export type NavLink = ExternalLink | InternalLink;

export const siteNavLinks: NavLink[] = [
  { label: '首页', href: '/' },
  { label: '全部游戏', href: '/#game-list' },
  { label: '项目动态', href: 'https://github.com/pvp-games', external: true },
];

export const footerLinks: NavLink[] = [
  { label: '开源仓库', href: 'https://github.com/pvp-games', external: true },
  { label: '反馈建议', href: 'https://github.com/pvp-games/pvp-games/issues', external: true },
];
