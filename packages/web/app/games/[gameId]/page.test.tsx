import React from 'react';
import { render, screen } from '@testing-library/react';

const mockGameSummaries = vi.fn(() => [
  {
    id: 'duel-snake',
    title: 'Stub Duel Snake',
    description: 'stub description',
    tags: ['daily', 'local']
  }
]);

vi.mock('@pvp-games/games', () => ({
  DuelSnakeExperience: () => <div data-testid="duel-snake-experience" />,
  getGameSummaries: mockGameSummaries
}));

let GamePage: typeof import('./page').default;
let generateStaticParams: typeof import('./page').generateStaticParams;

beforeEach(async () => {
  vi.resetModules();
  mockGameSummaries.mockClear();
  const mod = await import('./page');
  GamePage = mod.default;
  generateStaticParams = mod.generateStaticParams;
});

describe('GamePage', () => {
  it('renders the requested game detail page and mounts the experience component', async () => {
    render(await GamePage({ params: { gameId: 'duel-snake' } }));

    expect(screen.getByRole('heading', { level: 1, name: /stub duel snake/i })).toBeInTheDocument();
    expect(screen.getByText(/stub description/i)).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
    expect(screen.getByTestId('duel-snake-experience')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回大厅/i })).toHaveAttribute('href', '/');
  });

  it('exports static params for every game slug in the catalog', async () => {
    expect(generateStaticParams()).toEqual([{ gameId: 'duel-snake' }]);
    expect(mockGameSummaries).toHaveBeenCalled();
  });

  it('falls back to a built-in catalog when summaries cannot be loaded', async () => {
    mockGameSummaries.mockImplementationOnce(() => {
      throw new Error('load failure');
    });

    render(await GamePage({ params: { gameId: 'duel-snake' } }));

    expect(screen.getByRole('heading', { level: 1, name: /duel snake/i })).toBeInTheDocument();
    expect(screen.getByText(/本地双人/i)).toBeInTheDocument();
    expect(screen.getByTestId('duel-snake-experience')).toBeInTheDocument();
  });
});
