# Vite 本地测试脚手架设计

## 目标
- 为本地 2P Duel Snake 提供可直接部署到服务器的前端产物，使用 Vite + React + TypeScript 构建。
- 运行 `pnpm -C packages/web dev` 即可本地预览，`pnpm -C packages/web build && pnpm -C packages/web preview` 可在服务器上跑生产包。
- 允许直接从 monorepo 导入 `packages/games` 源码，便于快速迭代 UI。

## 配置要点
- Vite 5 + React 插件，ESNext 目标，生成 source map 便于部署后调试。
- `server.host=0.0.0.0`、`server.port=4173`、`preview.port=4173`，`strictPort=true`，方便服务器固定暴露端口。
- `server.fs.allow` 包含仓库根目录，允许跨包引用游戏引擎源码。
- 构建输出 `dist/`，`base='/'` 以默认根路径部署。
- TypeScript 统一使用 `moduleResolution: bundler`，各包以 `src` 为 `rootDir` 产出类型，测试/配置通过独立 `tsconfig.vitest.json` 加载，避免部署构建时包含测试文件。

## UI 行为草案
- 单页 App，展示标题、简单说明（方向键 vs WASD）。
- 提供“开始对战”与“重新开始”按钮：点击后对双方调用 ready/start，并重置状态。
- 使用 DuelSnakeGame 作为状态源：定时 tick，渲染网格、果子与蛇身体，显示得分与胜者。
- 键盘监听：方向键控制 P1，WASD 控制 P2，禁掉反向输入逻辑由引擎负责。

## 测试计划
- 配置测试：读取 `vite.config.ts` 验证 host、port、fs.allow、插件与 build 选项。
- UI 测试：渲染 App，断言标题/说明、得分面板、按钮存在；模拟点击“开始对战”后状态进入 running，并能重置。
