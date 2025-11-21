import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

function setup() {
  vi.useFakeTimers();
  return () => vi.useRealTimers();
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
    } finally {
      restore();
    }
  });

  it('支持开始对战并重置状态', async () => {
    const restore = setup();
    try {
      render(<App />);

      expect(screen.getByText(/P1 分数: 0/i)).toBeInTheDocument();
      expect(screen.getByText(/P2 分数: 0/i)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /开始对战/i }));
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByText(/对局进行中/i)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /重新开始/i }));
      });
      expect(screen.getByText(/等待开始/i)).toBeInTheDocument();
      expect(screen.getByText(/P1 分数: 0/i)).toBeInTheDocument();
      expect(screen.getByText(/P2 分数: 0/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
