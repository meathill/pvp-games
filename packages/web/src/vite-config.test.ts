import { resolve } from 'node:path';
import config from '../vite.config';

describe('vite.config', () => {
  it('配置了部署所需的 host/port 与跨包访问权限', () => {
    expect(config.server?.host).toBe('0.0.0.0');
    expect(config.server?.port).toBe(4173);
    expect(config.server?.strictPort).toBe(true);
    const allowList = config.server?.fs?.allow ?? [];
    expect(allowList.map((p) => p.replace(/\\/g, '/'))).toContain(
      resolve(__dirname, '..', '..').replace(/\\/g, '/')
    );
  });

  it('使用 React 插件并输出可调试的构建产物', () => {
    const pluginNames = (config.plugins ?? []).map((plugin) => plugin?.name);
    expect(pluginNames.some((name) => typeof name === 'string' && name.includes('react'))).toBe(true);
    expect(config.build?.outDir).toBe('dist');
    expect(config.build?.sourcemap).toBe(true);
    expect(config.base).toBe('/');
    expect(config.preview?.port).toBe(4173);
  });
});
