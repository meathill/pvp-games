import { describe, expect, it } from 'vitest';
import { createServerConfig } from '../src/index.js';

describe('server package', () => {
  it('produces a default server configuration placeholder', () => {
    const config = createServerConfig();

    expect(config.port).toBe(3000);
    expect(config.protocol).toBe('webrtc');
  });
});
