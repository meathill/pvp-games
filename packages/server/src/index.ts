import { createSharedContext } from '@pvp-games/shared';
import type { SharedContext } from '@pvp-games/shared';

export interface ServerConfig {
  port: number;
  protocol: 'webrtc' | 'ws';
  shared: SharedContext;
}

export function createServerConfig(overrides: Partial<Omit<ServerConfig, 'shared'>> = {}): ServerConfig {
  return {
    port: overrides.port ?? 3000,
    protocol: overrides.protocol ?? 'webrtc',
    shared: createSharedContext({ project: 'pvp-games' }),
  };
}

export { DODataExchanger } from './durable-object';
