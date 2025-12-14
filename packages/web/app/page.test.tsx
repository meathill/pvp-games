import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@pvp-games/games', () => ({
  getGameSummaries: () => [
    {
      id: 'duel-snake',
      title: 'Stub Duel Snake',
      description: 'stub description',
      tags: ['daily', 'local'],
    },
    {
      id: 'sky-pong',
      title: 'Sky Pong',
      description: 'cloud pong battles',
      tags: ['online'],
    },
  ],
}));

import HomePage from './page';

describe('HomePage', () => {
  it('shows the hero CTA and links to the featured game page instead of直接开局', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: /pvp 游戏大厅/i })).toBeInTheDocument();
    expect(screen.getByText(/今日推荐 · Stub Duel Snake/i)).toBeInTheDocument();
    expect(screen.getByText(/共 2 款上架/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /立即开局/i })).toHaveAttribute('href', '/games/duel-snake');
    expect(screen.queryByTestId('duel-snake-stub')).not.toBeInTheDocument();
  });

  it('renders all game cards from the library', () => {
    render(<HomePage />);

    expect(screen.getAllByText('Stub Duel Snake')).not.toHaveLength(0);
    expect(screen.getByText('Sky Pong')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /进入游戏/i })[0]).toHaveAttribute('href', '/games/duel-snake');
  });
});
