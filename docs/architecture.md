# 架构概览

## 文档原则
- 只保留必要文档：README（面向用户）、TESTING（测试指南）、.github/copilot-instructions.md（代码风格与架构约定，可被 Gemini/Codex/GitHub Copilot CLI 直接消费）。
- 文档内容需精准并保持及时更新；重要信息放在合适位置，避免冗余与冲突。
- 临时信息集中在 dev-note.md/WIP.md（中短期计划）和 TODO.md（长期关注点），阶段完成后及时清理旧文档并补充新文档。

## 网络方案
- **WebRTC + 服务器协助信令：** 客户端通过轻量信令服务（HTTP 或 WebSocket）建立会话、匹配玩家并交换 ICE；建立后走点对点 DataChannel 传输游戏数据。
- **Cloudflare Durable Object 作为信令/中转：** 以 Durable Object 房间实例管理玩家列表、就绪状态与 ICE/offer/answer 交换；同一实例同时提供 WebSocket Relay 兜底，当 WebRTC 失败或受限时转为有序广播。
- **TURN/STUN 兜底：** 默认直连，必要时使用配置好的 STUN/TURN（含 Google STUN）以穿透 NAT/防火墙。
- **消息封装：** 采用带版本号的 JSON 信封，配合共享模块的模式校验，保证客户端与服务器兼容。

## 模块职责
- **Server：** 会话创建/加入、信令端点、分发 TURN/STUN 配置、基础权限校验（如房间成员）、遥测与可选的回放/排行榜存储。
- **Games（如 Snake）：** 客户端渲染与模拟循环、游戏内消息处理、远端输入的对账与补偿；规则需确定性以支持锁步校验。
- **Shared：** 协议契约（TypeScript 类型/模式）、校验助手、时钟同步、随机种子管理、测试夹具，供 server 与 games 复用。

## 流程（设计 → 测试 → 编码）
1. **设计：** 先在文档中写出协议/状态图与信令、玩法时序草图。
2. **测试：** 为模式、消息处理、确定性模拟添加单元/契约测试，优先放在 shared，确保失败再补需求。
3. **编码：** 按测试实现 server/client，小步提交；每完成一阶段立即跑相关测试，避免回归。

## 初始测试指引
- 信令与游戏载荷的模式测试（TypeScript 类型 + 运行时校验）。
- 确定性模拟测试（固定随机种子、固定 tick），验证锁步一致性与回滚安全。
- 在测试中加入延迟/丢包模拟，覆盖 DataChannel 处理的鲁棒性。
- 每次改动跑 lint/type-check；重要合并后做 lobby 创建与 P2P 连接的冒烟。

## 路线图（首个 PvP：Snake）
- 里程碑 1：共享契约覆盖 lobby、匹配、Snake 状态快照，并附测试。
- 里程碑 2：WebRTC 信令链路（创建/加入/ICE 交换），配无头集成测试。
- 里程碑 3：Snake 确定性引擎（网格、食物、碰撞、计分），含支持回滚的状态 diff 测试。
- 里程碑 4：客户端 UI（输入缓冲、渲染循环）与跨端同步验证。
- 里程碑 5：遥测、重连/观战支持与赛后总结。

## 联网对战实施计划（Cloudflare Durable Object）
围绕“先设计 → 写测试 → 再编码”的流程，将联网模块拆解为以下阶段（每阶段结束都执行对应测试）：

1. **契约与房间设计（文档阶段）**：
   - 定义 Durable Object 房间模型：房间 UUID、玩家槽位、ready 状态、WebRTC 信令缓冲、Relay 队列。
   - 设计消息协议（版本号、动作类型、负载结构）与错误码，区分 WebRTC 信令与 WebSocket Relay 载荷。
   - 规划前端共享 SDK（`packages/netplay`）的 API：创建/加入房间、ready/start 流程、事件订阅。

2. **测试编写阶段**：
   - 在共享模块添加协议与状态机的类型/运行时模式测试，确保房间生命周期、信令与回退路径可验证。
   - 为 Durable Object Handler 写单元/集成测试：创建房间、两端加入、信令转发、WebSocket Relay 透传、异常恢复。
   - 前端 hook/Provider 的契约测试：模拟房间创建分享链接、双方 ready 后触发 start 事件。

3. **编码与集成阶段**：
   - 实现 `packages/netplay` SDK：封装 WebRTC（Google STUN 默认，可配置 TURN）、信令消息编解码、WebSocket Relay 回退。
   - 在 Cloudflare Worker/Durable Object 中落地房间逻辑与信令/Relay 端点，提供 HTTP 创建链接与 WebSocket 接入。
   - 将 Duel Snake 等游戏接入 SDK，打通“创建链接 → 分享 → 双方开始”完整链路，并补充 README/TESTING。
