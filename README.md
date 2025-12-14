PVP games
====
我想在这个仓库里开发各种的 PVP 游戏。我的想法很简单，用一些低成本的网络通信方案，比如 WebRTC，然后把各种经典游戏加上 PVP。比如 PVP 贪吃蛇，就是两个人各控制一条蛇，然后吃果子，看谁先吃够 N 个果子。这个项目应该是一个 monorepo，分成两个大模组，一个是服务器，一个是游戏。然后还会有很多公共组件。

## Monorepo 结构
- `packages/signaling`: 信令服务器，基于 Cloudflare Durable Object，负责房间管理和消息中继。
- `packages/games`: 游戏合集，包含本地 2P 和在线 PVP 的 Duel Snake。
- `packages/shared`: 可复用的共享上下文、类型和网络工具。
- `packages/web`: 基于 Next.js 的前端门户，负责 SEO 友好的展示与游戏入口。

使用 pnpm workspaces 管理，运行 `pnpm install` 后可以在根目录使用 `pnpm test`、`pnpm build` 等脚本串行调用所有子包。

## 快速开始

### 本地开发
```bash
# 安装依赖
pnpm install

# 启动信令服务器（终端 1）
pnpm dev:signaling

# 启动前端（终端 2）
pnpm dev
```

### 部署到 Cloudflare
```bash
# 部署信令服务
pnpm deploy:signaling

# 部署前端（需要先配置环境变量）
cd packages/web && pnpm build && npx wrangler deploy
```

详见 [部署文档](docs/deployment.md) 和 [本地测试文档](docs/local-testing.md)。
