import type { GameSummary } from '@pvp-games/games';

export const hallHighlights = [
  {
    title: '零等待开局',
    description: '无需下载，浏览器即可进入本地或在线对战。',
  },
  {
    title: '每日推荐',
    description: '根据游玩反馈轮换首页展示，让大厅保持新鲜。',
  },
  {
    title: '共享引擎',
    description: '核心玩法托管在 @pvp-games/games，前端按需加载。',
  },
];

export const sidebarNotices = [
  {
    title: '在线对战已上线',
    description: '支持 WebRTC P2P 直连，低延迟畅玩。',
    tone: '新功能',
  },
  {
    title: '邀请好友对战',
    description: '创建房间后分享链接，好友点击即可加入。',
    tone: '玩法',
  },
  {
    title: '更多游戏开发中',
    description: '敬请期待更多轻量级 PVP 游戏上线！',
    tone: '预告',
  },
];

// 优先推荐在线版本
const FEATURED_GAME_ID = 'duel-snake-online';

export function pickFeaturedGame(games: GameSummary[]): GameSummary | undefined {
  return games.find((game) => game.id === FEATURED_GAME_ID) ?? games[0];
}
