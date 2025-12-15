import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DuelSnakeExperience } from '../src/duel-snake/react';

describe('DuelSnakeExperience', () => {
  it('renders duel snake from the games package and transitions to running state', async () => {
    const user = userEvent.setup();

    render(<DuelSnakeExperience initialSeed="tdd-seed" />);

    expect(screen.getByRole('heading', { level: 1, name: /贪吃蛇/i })).toBeInTheDocument();
    expect(screen.getByText(/P1 分数: 0/)).toBeInTheDocument();
    expect(screen.getByText(/P2 分数: 0/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /开始对战/ }));

    expect(screen.getByText(/对局进行中/)).toBeInTheDocument();

    const grid = screen.getByTestId('board-grid');
    const cells = within(grid).getAllByRole('presentation', { hidden: true });
    expect(cells).toHaveLength(40 * 30);
  });

  it('exposes fallbacks for player identification when styles are missing', () => {
    render(<DuelSnakeExperience initialSeed="tdd-seed" />);

    const p1Cell = screen.getByLabelText('cell-2-1');
    const p2Cell = screen.getByLabelText('cell-37-28');

    expect(p1Cell).toHaveAttribute('title', expect.stringContaining('P1'));
    expect(p2Cell).toHaveAttribute('title', expect.stringContaining('P2'));

    expect(p1Cell).toHaveStyle({ backgroundColor: '#34d399' });
    expect(p2Cell).toHaveStyle({ backgroundColor: '#38bdf8' });

    const p1Badge = screen.getByLabelText(/P1 分数:/);
    const p2Badge = screen.getByLabelText(/P2 分数:/);

    expect(p1Badge).toHaveAttribute('title', expect.stringContaining('P1'));
    expect(p2Badge).toHaveAttribute('title', expect.stringContaining('P2'));

    expect(p1Badge).toHaveStyle({ backgroundColor: '#ecfdf3', color: '#065f46' });
    expect(p2Badge).toHaveStyle({ backgroundColor: '#f0f9ff', color: '#0ea5e9' });
  });
});
