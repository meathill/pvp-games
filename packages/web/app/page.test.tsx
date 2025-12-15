import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@pvp-games/games', () => ({
  getGameSummaries: () => [
    {
      id: 'duel-snake-online',
      title: 'Duel Snake Online',
      description: '在线双人对战',
      tags: ['online', 'pvp'],
    },
    {
      id: 'duel-snake',
      title: 'Duel Snake Local',
      description: '本地双人对战',
      tags: ['local', '2p'],
    },
  ],
}));

import HomePage from './page';

describe('HomePage', () => {
  it('shows the hero section with online game featured', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: /pvp 游戏大厅/i })).toBeInTheDocument();
    expect(screen.getByText(/在线可用/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /立即开始对战/i })).toHaveAttribute('href', '/games/duel-snake-online');
  });

  it('renders featured game and local game sections', () => {
    render(<HomePage />);

    // Featured game (online)
    expect(screen.getByText('Duel Snake Online')).toBeInTheDocument();
    expect(screen.getByText(/在线双人对战/)).toBeInTheDocument();

    // Local game (secondary)
    expect(screen.getByText('Duel Snake Local')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /进入游戏/i })).toHaveAttribute('href', '/games/duel-snake');
  });
});
