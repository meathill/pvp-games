# 广域网部署指南

本文档介绍如何将 PVP 贪吃蛇在线对战功能部署到 Cloudflare。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare 网络                         │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │  pvp-games      │         │  pvp-signaling          │   │
│  │  (Next.js)      │         │  (Durable Object)       │   │
│  │                 │         │                         │   │
│  │  前端页面       │◄───────►│  WebSocket 信令服务     │   │
│  │  游戏渲染       │         │  房间管理               │   │
│  └─────────────────┘         └─────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

部署分为两个独立的 Cloudflare Workers：
1. **pvp-games** - Next.js 前端（已有）
2. **pvp-signaling** - WebSocket 信令服务（新增）

## 前置条件

1. Cloudflare 账户
2. Wrangler CLI 已登录：`npx wrangler login`
3. 项目依赖已安装：`pnpm install`

## 部署步骤

### 第一步：部署信令服务

```bash
cd packages/signaling
pnpm install
pnpm deploy
```

部署成功后，你会看到类似输出：

```
Published pvp-signaling (x.xx sec)
  https://pvp-signaling.<your-subdomain>.workers.dev
```

**记下这个 URL**，后面需要用到。

### 第二步：配置前端环境变量

创建或编辑 `packages/web/.env.production`：

```bash
# 替换为你的信令服务 URL
NEXT_PUBLIC_SIGNALING_URL=wss://pvp-signaling.<your-subdomain>.workers.dev/ws
```

> 注意：生产环境使用 `wss://`（加密），而非 `ws://`

### 第三步：部署前端

```bash
cd packages/web
pnpm build
pnpm wrangler deploy
```

## 验证部署

1. 访问你的前端 URL：`https://pvp-games.<your-subdomain>.workers.dev`
2. 进入"贪吃蛇在线对战"
3. 创建房间，在另一个设备或浏览器加入
4. 验证游戏能正常进行

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NEXT_PUBLIC_SIGNALING_URL` | 信令服务 WebSocket URL | `wss://pvp-signaling.xxx.workers.dev/ws` |

## 自定义域名（可选）

### 为信令服务配置自定义域名

1. 在 Cloudflare Dashboard 进入 Workers & Pages
2. 找到 `pvp-signaling` Worker
3. 进入 Settings → Triggers → Custom Domains
4. 添加自定义域名，如 `ws.yourdomain.com`

然后更新前端环境变量：

```bash
NEXT_PUBLIC_SIGNALING_URL=wss://ws.yourdomain.com/ws
```

### 为前端配置自定义域名

类似步骤，为 `pvp-games` Worker 配置自定义域名。

## 监控与调试

### 查看信令服务日志

```bash
cd packages/signaling
npx wrangler tail
```

### 查看房间状态

```bash
curl https://pvp-signaling.<your-subdomain>.workers.dev/api/room/ROOMID
```

### 常见问题

#### 连接失败

1. 检查环境变量 `NEXT_PUBLIC_SIGNALING_URL` 是否正确
2. 确认使用 `wss://` 而非 `ws://`
3. 查看浏览器控制台错误信息

#### 游戏延迟高

- Cloudflare 会自动选择最近的边缘节点
- 如果延迟仍然高，可能是跨地区连接
- 未来可以考虑实现 WebRTC P2P 连接

#### 房间无法创建

- 检查信令服务是否正常运行
- 查看 Worker 日志是否有错误

## 成本估算

Cloudflare Workers 免费计划包含：
- 每日 100,000 次请求
- Durable Objects：每月 100,000 次请求 + 1GB 存储

对于小型项目，免费计划通常足够。

## 更新部署

### 更新信令服务

```bash
cd packages/signaling
pnpm deploy
```

### 更新前端

```bash
cd packages/web
pnpm build
pnpm wrangler deploy
```

## 回滚

如需回滚到之前版本：

```bash
npx wrangler rollback
```

## 下一步

- [ ] 配置自定义域名
- [ ] 设置监控告警
- [ ] 考虑实现 WebRTC P2P 降低延迟
- [ ] 添加房间密码功能
- [ ] 实现匹配系统
