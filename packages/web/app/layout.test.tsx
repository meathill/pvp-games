import React from 'react';
import { render, screen, within } from '@testing-library/react';

import RootLayout from './layout';

describe('RootLayout', () => {
  it('renders shared site header and footer around the page', () => {
    render(
      <RootLayout>
        <main>页面内容</main>
      </RootLayout>
    );

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /pvp 游戏大厅/i })).toHaveAttribute('href', '/');
    expect(within(header).getByRole('link', { name: /全部游戏/i })).toHaveAttribute('href', '/#game-list');

    expect(screen.getByText('页面内容')).toBeInTheDocument();

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(/©/)).toBeInTheDocument();
  });
});
