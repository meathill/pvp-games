import type { PlayerId } from './engine';

// 渲染常量
export const CELL_SIZE = 18;
export const CELL_GAP = 2;

// 玩家颜色配置
export const PLAYER_COLORS: Record<PlayerId, { primary: string; stroke: string; light: string; text: string }> = {
  p1: {
    primary: '#34d399',
    stroke: 'rgba(110, 231, 183, 0.7)',
    light: '#ecfdf3',
    text: '#065f46',
  },
  p2: {
    primary: '#38bdf8',
    stroke: 'rgba(125, 211, 252, 0.7)',
    light: '#f0f9ff',
    text: '#0ea5e9',
  },
};

// 水果颜色
export const FRUIT_COLOR = {
  primary: '#f97316',
  stroke: 'rgba(251, 146, 60, 0.7)',
};
