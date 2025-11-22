import type { GameSummary } from '@pvp-games/games';

export const hallHighlights = [
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

export const sidebarNotices = [
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

const FEATURED_GAME_ID = 'duel-snake';

export function pickFeaturedGame(games: GameSummary[]): GameSummary | undefined {
  return games.find((game) => game.id === FEATURED_GAME_ID) ?? games[0];
}
