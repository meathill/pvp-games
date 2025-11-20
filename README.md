PVP games
====
我想在这个仓库里开发各种的 PVP 游戏。我的想法很简单，用一些低成本的网络通信方案，比如 WebRTC，然后把各种经典游戏加上 PVP。比如 P
VP 贪吃蛇，就是两个人各控制一条蛇，然后吃果子，看谁先吃够 N 个果子。这个项目应该是一个 monorepo，分成两个大模组，一个是服务器，一
个是游戏。然后还会有很多公共组件。

## Monorepo 结构
- `packages/server`: 服务器端占位实现，提供基础配置工厂。
- `packages/games`: 游戏合集占位实现，列出初始游戏列表。
- `packages/shared`: 可复用的共享上下文和类型。

使用 pnpm workspaces 管理，运行 `pnpm install` 后可以在根目录使用 `pnpm test`、`pnpm build` 等脚本串行调用所有子包。
