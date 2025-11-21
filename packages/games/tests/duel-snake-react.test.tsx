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
    expect(cells).toHaveLength(20 * 15);
  });
});
