# Duel Snake 在线对战与 PVP 通用骨架

目标：在保持本地 2P 体验的同时，增加一套可复用的在线对战骨架，让 Duel Snake 支持主机-客机（host/guest）联机，并为后续其它 PVP 游戏复用消息通道、准备流程与状态广播模式。

## 角色与消息
- 角色：`host` 负责权威逻辑运算（握有 `DuelSnakeGame` 实例），`guest` 只发送输入并接收状态。
- 通道：使用可替换的 `RealtimeEndpoint`（默认内存双工），格式为 `{ from, payload, createdAt }`，可替换为 WebRTC/WS 等实现。
- 消息：
  - `ready`：某端已准备好；host 收到 host 与 guest 都 ready 后调用 `game.start()` 并广播状态。
  - `input`：带方向的输入，guest→host 时映射为 `p2`，host 本地输入映射为 `p1`。
  - `state`：host 每次 `tick()` 后广播的最新 `DuelSnakeState`（含 tick 序号）。

## 游戏循环
1. host/guest 各自调用 `markReady()`，通过通道互相同步。
2. host 收到双方 ready 后：
   - 为 p1/p2 设置 ready，调用 `start()`，推送一帧 `state` 给 guest。
3. 输入：
   - host 本地按键 → `queueInput('p1', dir)`。
   - guest 发送 input → host 记录到 `p2` 的 `pendingDirection`。
4. Tick：host 以固定节奏或外部驱动调用 `tick()`，处理碰撞/得分并广播状态。
5. 结束：当 `winner` 产生，`state` 中带 `finished`，guest 单向展示即可。

## 可复用基石
- `RealtimeEndpoint` 与 `createLinkedRealtimeEndpoints`：一对带 `from` 元信息的双工通道，测试用内存实现，未来可接驳 WebRTC DataChannel。
- `OnlineHostDriver`/`OnlineClientView`（此次以 Duel Snake 具体类实现）：
  - host 负责握有权威游戏实例与 tick/broadcast；
  - client 负责发送输入、缓存最新状态；
  - 状态载荷完全类型化，方便移植到其它 PVP 游戏。

## 范围界定
- UI 暂不改动，核心聚焦同步模型与测试覆盖。
- host tick 由外部驱动（测试用手动、运行时可接 setInterval），保持确定性与测试友好。
