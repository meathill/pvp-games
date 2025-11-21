# Duel Snake（本地 2P）设计纲要

目标：同机 2P 轮询驱动的贪吃蛇对决。1P 使用方向键、2P 使用 WASD。双方点击开始后进入 tick 循环，先吃到 10 个果子的一方胜出，死亡后在随机角落以 3 格长度立即重生。

## 核心参数
- 网格：默认 20x15，可配置。
- Tick 间隔：逻辑层使用固定节奏（默认 120ms），允许外部驱动手动 `tick()` 以便测试。
- 胜利条件：率先得分到 10 即宣布胜者并进入 `finished` 状态。
- 随机性：所有随机点（果子、角落重生）基于可注入的种子 RNG，保证测试可重复。

## 状态与模型
- `PlayerId`: `p1` | `p2`。
- `GameStatus`: `idle` | `ready` | `running` | `finished`。
- 玩家状态：
  - `direction` 当前朝向。
  - `pendingDirection` 记录本 tick 采集到的输入（防止 180 度反转）。
  - `segments` 存储蛇身坐标，头在数组前端。
  - `score` 计分。
  - `alive` 标记是否可移动；死亡后立即重生。
- 全局：`fruit` 单一果子坐标，`winner` 可选。

## 生命周期
1. 初始为 `idle`，调用 `ready(player)` 标记准备；两侧都 ready 后状态为 `ready`。
2. 显式调用 `start()` 或在外部满足 ready 条件后进入 `running`，开始 tick。
3. 每个 `tick()`：
   - 将本 tick 收到的输入转为方向（拒绝反向）。
   - 依次移动每条蛇，得到新头部位置。
   - 碰撞检测：
     - 触墙、撞到任意蛇身（含自己）即死亡；`respawn()` 立即在随机角落生成 3 格朝向中心的新蛇并清空 pending 输入。
   - 果子判定：
     - 头部与果子重合则得分+1、保留尾巴增加长度，并重新生成果子在空白格。
   - 胜负：
     - 任意玩家得分达到 10，状态转 `finished`，记录 `winner`，停止后续 tick。

## 输入映射与并发
- 1P：↑/↓/←/→ 对应 `up`/`down`/`left`/`right`。
- 2P：W/S/A/D 对应相同方向枚举。
- 同一 tick 多次输入仅采用最后一个有效方向，且禁止本 tick 直接 180 度掉头。

## 重生与角落
- 角落集合：`(1,1)`、`(width-2,1)`、`(1,height-2)`、`(width-2,height-2)` 为中心的水平 3 连格，朝向网格中心。
- 开局固定在对角角落生成（p1 左上朝右，p2 右下朝左）；后续重生时再使用随机角落策略。
- 重生后本 tick 不移动额外距离（位置立即更新）。

## 公开接口
- `DuelSnakeGame` 类：
  - 构造参数：`width`、`height`、`targetScore`、`seed`、`tickIntervalMs`。
  - `ready(player)`、`start()`、`queueInput(player, direction)`、`tick()`、`getState()`、`setFruitForTest()`（测试辅助）。
- 元数据：在 `getGameSummaries` 中提供标题、支持本地 2P 说明，供 UI 列表消费。
