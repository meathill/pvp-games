import config from '../tailwind.config.js';

describe('tailwind.config', () => {
  it('使用 class 模式并显式声明扫描文件', () => {
    expect(config.darkMode).toBe('class');

    const content = (config as unknown as { content?: unknown }).content;
    const files = typeof content === 'object' && content !== null && 'files' in content
      ? (content as { files?: unknown }).files
      : undefined;

    expect(Array.isArray(files)).toBe(true);
    expect((files as unknown[]).length).toBeGreaterThan(0);
    expect(files).toEqual(expect.arrayContaining(['./index.html']));
  });
});
