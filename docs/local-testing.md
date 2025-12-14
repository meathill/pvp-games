# 局域网联机测试指南

本文档介绍如何在本地局域网环境下测试 PVP 贪吃蛇的在线对战功能。

## 前置条件

- Node.js 18+
- pnpm 10+

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动信令服务器

在一个终端窗口运行：

```bash
pnpm dev:signaling
```

这会使用 Wrangler 在本地启动一个模拟 Cloudflare Workers 环境的服务器（包括 Durable Object 支持）。

你会看到类似输出：

```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### 3. 启动前端开发服务器

在另一个终端窗口运行：

```bash
pnpm dev
```

前端会在 `http://localhost:3020` 启动。

> 注意：端口可能是 3000 或 3020，取决于配置。

### 4. 测试联机对战

#### 同一台电脑测试（开两个浏览器窗口）

1. 打开 `http://localhost:3020/games/duel-snake-online`
2. 在第一个窗口点击"创建房间"，记下 6 位房间码
3. 在第二个窗口（或无痕模式）输入房间码，点击"加入房间"
4. 两人都加入后游戏自动开始

#### 局域网内两台电脑测试

1. 确保两台电脑在同一局域网
2. 获取运行服务器的电脑 IP 地址：
   ```bash
   # macOS
   ipconfig getifaddr en0
   
   # Linux
   hostname -I | awk '{print $1}'
   
   # Windows
   ipconfig | findstr "IPv4"
   ```
3. 主机玩家：
   - 打开 `http://localhost:3020/games/duel-snake-online`
   - 点击"创建房间"
   - 记下房间码分享给对手
4. 访客玩家：
   - 打开 `http://<主机IP>:3020/games/duel-snake-online`
   - 展开"高级设置"
   - 将信令服务器地址改为 `ws://<主机IP>:8787/ws`
   - 输入房间码，点击"加入房间"
5. 游戏开始！

## 控制方式

| 按键 | 动作 |
|------|------|
| ↑ / W | 向上移动 |
| ↓ / S | 向下移动 |
| ← / A | 向左移动 |
| → / D | 向右移动 |

先吃到 10 个果子的玩家获胜。

## 架构说明

```
┌─────────────────┐         ┌─────────────────┐
│   主机 (Host)    │         │   访客 (Guest)   │
│  - 游戏逻辑      │         │  - 发送输入      │
│  - 状态广播      │         │  - 接收状态      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │     WebSocket 连接         │
         │                           │
         └───────────┬───────────────┘
                     │
              ┌──────┴──────┐
              │ 信令服务器   │
              │ (port 8787) │
              │ Durable Obj │
              └─────────────┘
```

### 消息流程

1. **房间创建**：Host 连接到信令服务，创建 Durable Object 实例
2. **Guest 加入**：Guest 连接到同一房间，触发 `room-ready` 事件
3. **游戏同步**：Host 运行游戏逻辑，通过 WebSocket 广播状态
4. **输入处理**：Guest 的输入通过 WebSocket 发送到 Host

## 故障排除

### 连接失败 / 1006 错误

1. **检查 VPN** - 关闭 VPN 后重试
2. **检查服务器** - 确认信令服务器正在运行
3. **检查端口** - 确保 8787 端口未被占用
4. **检查防火墙** - 允许 8787 和 3020 端口

### 游戏延迟高

- 局域网内延迟应该 < 10ms
- 检查网络质量：`ping <对方IP>`
- 查看浏览器控制台是否有错误

### 房间码无效

- 房间码是 6 位字母数字组合
- 房间 1 分钟无人后自动清理
- 确保两端使用相同的信令服务器地址

### Wrangler 启动失败

```bash
# 检查是否有进程占用端口
lsof -i :8787

# 强制终止（如果需要）
kill -9 <PID>
```

### React Strict Mode 导致的问题

开发模式下 React Strict Mode 会导致组件双重渲染，这可能造成 WebSocket 连接问题。代码已经处理了这种情况，但如果遇到问题可以尝试：

1. 在生产构建中测试：`pnpm -C packages/web build && pnpm -C packages/web start`
2. 或临时关闭 Strict Mode

## API 端点

### 健康检查

```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

### 房间信息

```bash
curl http://localhost:8787/api/room/ROOMID
# {"hasHost":true,"hasGuest":false,"createdAt":...}
```

### WebSocket 连接

```
ws://localhost:8787/ws?room=ROOMID&role=host
ws://localhost:8787/ws?room=ROOMID&role=guest
```

## 开发技巧

### 同时查看两端日志

使用 tmux 或多个终端窗口：

```bash
# 终端 1：信令服务器
pnpm dev:signaling

# 终端 2：前端
pnpm dev

# 终端 3：查看信令服务器日志
cd packages/signaling && npx wrangler tail --local
```

### 测试消息格式

在浏览器控制台查看 WebSocket 消息：

```javascript
// 在开发者工具 Console 中
// 游戏消息会被记录到控制台
```

## 下一步

完成局域网测试后，可以部署到 Cloudflare：

1. 部署信令服务：`pnpm deploy:signaling`
2. 配置前端环境变量
3. 部署前端
4. 进行广域网测试

详见 [部署指南](./deployment.md)。
