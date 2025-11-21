import React from 'react';
import { render, screen } from '@testing-library/react';

import HomePage from './page';

vi.mock('@pvp-games/games', () => ({
  DuelSnakeExperience: () => <div data-testid="duel-snake-stub" />,
  getGameSummaries: () => [
    {
      id: 'duel-snake',
      title: 'Stub Duel Snake',
      description: 'stub description',
      tags: ['daily', 'local']
    },
    {
      id: 'sky-pong',
      title: 'Sky Pong',
      description: 'cloud pong battles',
      tags: ['online']
    }
  ]
}));

describe('HomePage', () => {
  it('shows the hero CTA and highlights the daily pick from the games package', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: /pvp 游戏大厅/i })).toBeInTheDocument();
    expect(screen.getByText(/今日推荐 · Stub Duel Snake/i)).toBeInTheDocument();
    expect(screen.getByText(/共 2 款上架/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即开局/i })).toBeInTheDocument();
    expect(screen.getByTestId('duel-snake-stub')).toBeInTheDocument();
  });

  it('renders all game cards from the library', () => {
    render(<HomePage />);

    expect(screen.getAllByText('Stub Duel Snake')).not.toHaveLength(0);
    expect(screen.getByText('Sky Pong')).toBeInTheDocument();
  });
});
