import { describe, expect, it } from 'vitest';
import { createSharedContext } from '../src/index.js';

describe('shared package', () => {
  it('provides a reusable shared context skeleton', () => {
    const context = createSharedContext({ project: 'pvp-games' });

    expect(context.project).toBe('pvp-games');
    expect(context.metadata).toMatchObject({ initialized: true });
  });
});
