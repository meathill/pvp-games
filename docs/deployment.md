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

| Worker | 说明 | 技术栈 |
|--------|------|--------|
| `pvp-games` | 前端页面和游戏渲染 | Next.js + OpenNext |
| `pvp-signaling` | WebSocket 信令和房间管理 | Durable Object |

## 前置条件

1. **Cloudflare 账户** - 免费计划即可
2. **Wrangler CLI** - Cloudflare 的命令行工具
3. **项目依赖** - 已安装完成

### 登录 Cloudflare

```bash
npx wrangler login
```

这会打开浏览器进行授权。

### 安装依赖

```bash
pnpm install
```

## 部署步骤

### 第一步：部署信令服务

使用根目录的快捷命令：

```bash
pnpm deploy:signaling
```

或者进入目录手动部署：

```bash
cd packages/signaling
pnpm deploy
```

部署成功后，你会看到类似输出：

```
✨ Uploaded pvp-signaling (x.xx sec)
✨ Deployed pvp-signaling to https://pvp-signaling.<your-subdomain>.workers.dev
```

**记下这个 URL**，后面需要用到。

### 第二步：配置前端环境变量

创建生产环境配置文件 `packages/web/.env.production`：

```bash
# 替换 <your-subdomain> 为你的实际子域名
NEXT_PUBLIC_SIGNALING_URL=wss://pvp-signaling.<your-subdomain>.workers.dev/ws
```

> ⚠️ **重要**：生产环境必须使用 `wss://`（加密 WebSocket），而非 `ws://`

### 第三步：部署前端

```bash
cd packages/web
pnpm deploy
```

这会执行以下步骤：
1. 使用 OpenNext 构建 Next.js 应用
2. 上传到 Cloudflare Workers

部署成功后，你会看到前端 URL：

```
✨ Deployed pvp-games to https://pvp-games.<your-subdomain>.workers.dev
```

## 验证部署

### 1. 检查信令服务健康状态

```bash
curl https://pvp-signaling.<your-subdomain>.workers.dev/health
```

应该返回：

```json
{"status":"ok"}
```

### 2. 测试在线对战

1. 打开前端 URL
2. 进入"贪吃蛇在线对战"（或直接访问 `/games/duel-snake-online`）
3. 点击"创建房间"
4. 在另一个设备或浏览器窗口输入房间码加入
5. 验证游戏能正常进行

## 环境变量

### 前端环境变量

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `NEXT_PUBLIC_SIGNALING_URL` | 是 | 信令服务 WebSocket URL | `wss://pvp-signaling.xxx.workers.dev/ws` |

### 信令服务环境变量

信令服务目前不需要额外的环境变量。

## 自定义域名

### 为信令服务配置自定义域名

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 找到 `pvp-signaling` Worker
4. 进入 **Settings → Triggers → Custom Domains**
5. 添加自定义域名，如 `ws.yourdomain.com`

然后更新前端环境变量：

```bash
NEXT_PUBLIC_SIGNALING_URL=wss://ws.yourdomain.com/ws
```

### 为前端配置自定义域名

类似步骤，为 `pvp-games` Worker 配置自定义域名。

## 监控与调试

### 实时查看日志

```bash
cd packages/signaling
npx wrangler tail
```

这会实时显示 Worker 的日志输出。

### 查看房间状态

```bash
curl https://pvp-signaling.<your-subdomain>.workers.dev/api/room/ROOMID
```

返回示例：

```json
{
  "hasHost": true,
  "hasGuest": false,
  "createdAt": 1702500000000,
  "lastActivity": 1702500100000
}
```

### Cloudflare Dashboard

在 Dashboard 中可以查看：
- 请求量统计
- 错误率
- CPU 使用时间
- Durable Object 存储使用量

## 常见问题

### 连接失败 / 1006 错误

1. **检查 URL 协议** - 确认使用 `wss://` 而非 `ws://`
2. **检查环境变量** - 确认 `NEXT_PUBLIC_SIGNALING_URL` 设置正确
3. **查看控制台** - 浏览器 F12 查看详细错误
4. **检查 CORS** - 信令服务已配置允许所有来源

### 游戏延迟高

- Cloudflare 会自动选择最近的边缘节点
- 跨地区玩家可能延迟较高（100-300ms）
- 未来可以考虑实现 WebRTC P2P 连接降低延迟

### 房间无法创建

1. 检查信令服务是否正常运行
2. 使用 `wrangler tail` 查看实时日志
3. 确认 Durable Object 迁移已完成

### 部署失败

```bash
# 查看详细错误
npx wrangler deploy --verbose

# 检查配置
npx wrangler whoami
```

## 成本估算

### Cloudflare Workers 免费计划

| 资源 | 免费额度 |
|------|----------|
| Workers 请求 | 每日 100,000 次 |
| Durable Objects 请求 | 每月 100,000 次 |
| Durable Objects 存储 | 1 GB |
| Workers CPU 时间 | 每日 10ms/请求 |

对于小型项目和测试，免费计划完全够用。

### 付费计划

如果需要更高的配额，Workers Paid 计划 $5/月 起。

## 更新部署

### 更新信令服务

```bash
pnpm deploy:signaling
```

### 更新前端

```bash
cd packages/web
pnpm deploy
```

### 查看部署历史

```bash
npx wrangler deployments list
```

## 回滚

如需回滚到之前版本：

```bash
# 查看可用版本
npx wrangler deployments list

# 回滚到指定版本
npx wrangler rollback
```

## 安全建议

1. **不要在代码中硬编码敏感信息**
2. **使用环境变量管理配置**
3. **考虑添加速率限制**防止滥用
4. **定期检查日志**发现异常

## 下一步

部署完成后，可以考虑：

- [ ] 配置自定义域名
- [ ] 设置 Cloudflare 监控告警
- [ ] 实现 WebRTC P2P 连接降低延迟
- [ ] 添加房间密码功能
- [ ] 实现随机匹配系统
- [ ] 添加观战功能
