PVP games
====
我想在这个仓库里开发各种的 PVP 游戏。我的想法很简单，用一些低成本的网络通信方案，比如 WebRTC，然后把各种经典游戏加上 PVP。比如 P
VP 贪吃蛇，就是两个人各控制一条蛇，然后吃果子，看谁先吃够 N 个果子。这个项目应该是一个 monorepo，分成两个大模组，一个是服务器，一
个是游戏。然后还会有很多公共组件。

## Monorepo 结构
- `packages/server`: 服务器端占位实现，提供基础配置工厂。
- `packages/games`: 游戏合集，现已包含本地 2P 的 Duel Snake 引擎（方向键 vs WASD）。
- `packages/shared`: 可复用的共享上下文和类型。
- `packages/web`: 基于 Next.js 的前端门户，负责 SEO 友好的展示与游戏入口，通过 `@pvp-games/games` 按需加载玩法。

使用 pnpm workspaces 管理，运行 `pnpm install` 后可以在根目录使用 `pnpm test`、`pnpm build` 等脚本串行调用所有子包。

## Web 端快速开始（Next.js）
- 开发预览：`pnpm -C packages/web dev`
- 生产构建：`pnpm -C packages/web build`
- 生产启动：`pnpm -C packages/web start`
