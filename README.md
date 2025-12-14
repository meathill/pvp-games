PVP games
====
我想在这个仓库里开发各种的 PVP 游戏。我的想法很简单，用一些低成本的网络通信方案，比如 WebRTC，然后把各种经典游戏加上 PVP。比如 PVP 贪吃蛇，就是两个人各控制一条蛇，然后吃果子，看谁先吃够 N 个果子。这个项目应该是一个 monorepo，分成两个大模组，一个是服务器，一个是游戏。然后还会有很多公共组件。

## Monorepo 结构

| 包 | 说明 |
|---|---|
| `packages/signaling` | 信令服务器，基于 Cloudflare Durable Object |
| `packages/games` | 游戏合集（本地 2P + 在线 PVP） |
| `packages/shared` | 共享上下文、类型和网络工具 |
| `packages/web` | Next.js 前端门户 |

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

然后访问 http://localhost:3020/games/duel-snake-online 开始在线对战。

### 运行测试

```bash
pnpm test
```

### 部署到 Cloudflare

```bash
# 部署信令服务
pnpm deploy:signaling

# 部署前端（需要先配置环境变量）
cd packages/web && pnpm deploy
```

## 文档

| 文档 | 说明 |
|------|------|
| [架构概览](docs/architecture.md) | 项目结构、网络架构、消息协议 |
| [本地测试](docs/local-testing.md) | 局域网联机测试指南 |
| [部署指南](docs/deployment.md) | Cloudflare 部署步骤 |
| [测试指南](docs/testing.md) | 测试策略和运行方法 |

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS 4
- **后端**: Cloudflare Workers, Durable Objects
- **测试**: Vitest 4, Testing Library
- **工具**: pnpm, TypeScript 5.9, Biome
