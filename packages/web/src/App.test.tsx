import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

function setup() {
  vi.useFakeTimers();
  return () => vi.useRealTimers();
}

function mockMatchMedia(initiallyDark = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mediaQuery: MediaQueryList = {
    matches: initiallyDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_event, handler) => {
      if (typeof handler === 'function') {
        listeners.add(handler as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (_event, handler) => {
      listeners.delete(handler as (event: MediaQueryListEvent) => void);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  };

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn(() => mediaQuery);

  const setMatches = (matches: boolean) => {
    mediaQuery.matches = matches;
    const event = new Event('change') as MediaQueryListEvent;
    Object.defineProperty(event, 'matches', { value: matches });
    listeners.forEach((listener) => listener(event));
  };

  return {
    restore: () => {
      window.matchMedia = originalMatchMedia;
    },
    setMatches
  };
}

describe('App', () => {
  it('展示标题、说明与基础操作按钮', () => {
    const restore = setup();
    try {
      render(<App />);

      expect(screen.getByText(/本地 2P 贪吃蛇/i)).toBeInTheDocument();
      expect(screen.getAllByText(/方向键/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/WASD/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /开始对战/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /重新开始/i })).toBeInTheDocument();
      expect(screen.getByText(/等待开始/i)).toBeInTheDocument();
      expect(screen.getByText(/Tick：187 ms/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('支持开始对战并重置状态', async () => {
    const restore = setup();
    try {
      render(<App />);

      expect(screen.getByLabelText(/P1 分数: 0/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/P2 分数: 0/i)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /开始对战/i }));
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByText(/对局进行中/i)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /重新开始/i }));
      });
      expect(screen.getByText(/等待开始/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/P1 分数: 0/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/P2 分数: 0/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('默认浅色模式，并可切换暗色和跟随系统', () => {
    const restoreTimers = setup();
    const { restore: restoreMatchMedia, setMatches } = mockMatchMedia(false);

    try {
      render(<App />);

      const themeSelector = screen.getByLabelText(/主题/i);

      expect(document.documentElement.classList.contains('dark')).toBe(false);

      act(() => {
        fireEvent.change(themeSelector, { target: { value: 'dark' } });
      });
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => {
        fireEvent.change(themeSelector, { target: { value: 'system' } });
      });
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      act(() => {
        setMatches(true);
      });
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      restoreTimers();
      restoreMatchMedia();
    }
  });

  it('使用固定单元格尺寸排列棋盘', () => {
    const restoreTimers = setup();
    const { restore: restoreMatchMedia } = mockMatchMedia(false);

    try {
      render(<App />);
      const grid = screen.getByTestId('board-grid');

      expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(20, 18px)' });
      expect(grid).toHaveStyle({ gridTemplateRows: 'repeat(15, 18px)' });
    } finally {
      restoreTimers();
      restoreMatchMedia();
    }
  });
});
