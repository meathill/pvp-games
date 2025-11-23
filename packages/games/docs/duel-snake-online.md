# Duel Snake 在线对战与 PVP 通用骨架

目标：在保持本地 2P 体验的同时，增加一套可复用的在线对战骨架，让 Duel Snake 支持主机-客机（host/guest）联机，并为后续其它 PVP 游戏复用消息通道、准备流程与状态广播模式。

## 架构概览

### 网络层级

1. **首选：WebRTC DataChannel**
   - 点对点低延迟连接
   - 使用 Google STUN 服务器进行 NAT 穿透
   - 通过 Cloudflare Durable Object 进行信令交换

2. **回退：WebSocket Relay**
   - 当 WebRTC 无法建立时自动降级
   - 通过 Cloudflare Durable Object 中转消息
   - 具有自动重连和指数退避

### 连接管理

`ConnectionManager` 类封装了完整的连接逻辑：
- 自动尝试 WebRTC，失败后回退到 WebSocket
- 提供统一的 `RealtimeEndpoint` 接口
- 支持连接状态监听和延迟测量

## 角色与消息

- 角色：`host` 负责权威逻辑运算（握有 `DuelSnakeGame` 实例），`guest` 只发送输入并接收状态。
- 通道：使用可替换的 `RealtimeEndpoint`（默认内存双工），可替换为 WebRTC/WS 等实现。
- 消息格式：`{ from, payload, createdAt }`，带版本号的 JSON 信封。

### 消息类型

- `ready`：某端已准备好
- `input`：带方向的输入，包含客户端 tick 用于延迟补偿
- `state`：host 每次 tick 后广播的状态，包含 tick 序号和服务器时间
- `sync-request`：客户端请求状态同步（如重连后）
- `ping`/`pong`：延迟测量

## 游戏循环

1. host/guest 各自调用 `markReady()`，通过通道互相同步。
2. host 收到双方 ready 后：
   - 为 p1/p2 设置 ready，调用 `start()`，推送一帧 `state` 给 guest。
3. 输入处理：
   - host 本地按键 → `queueInput('p1', dir)`
   - guest 发送 input → host 缓冲到输入队列，下一 tick 处理
4. Tick：host 以固定节奏调用 `tick()`，处理输入缓冲、碰撞/得分并广播状态。
5. 结束：当 `winner` 产生，`state` 中带 `finished`，guest 展示结果。

## Cloudflare Durable Object

`DODataExchanger` 类处理：
- WebSocket 连接管理（host/guest 槽位）
- WebRTC 信令转发（offer/answer/ICE candidate）
- 游戏消息中继（当使用 WebSocket 回退时）
- 房间生命周期（30 分钟超时清理）

## 延迟补偿

- 客户端定期发送 ping 测量往返延迟
- 输入消息携带客户端 tick，可用于服务端补偿
- Host 维护输入缓冲区处理网络抖动

## 可复用基石

- `RealtimeEndpoint` 接口：统一的消息收发抽象
- `WebRTCRealtimeEndpoint`：WebRTC DataChannel 实现
- `WebSocketRelayEndpoint`：WebSocket 中继实现
- `ConnectionManager`：自动选择最佳传输方式
- `DuelSnakeOnlineHost`/`DuelSnakeOnlineClient`：游戏特定的在线逻辑

## 范围界定

- UI 暂不改动，核心聚焦同步模型与测试覆盖。
- host tick 由外部驱动（测试用手动、运行时可接 `startLoop()`），保持确定性与测试友好。
