# 测试指南

本文档介绍 PVP Games 项目的测试策略和运行方法。

## 测试框架

- **Vitest 4.x** - 现代化的测试框架，兼容 Jest API
- **@testing-library/react** - React 组件测试
- **jsdom** - 浏览器环境模拟

## 运行测试

### 运行所有测试

```bash
pnpm test
```

### 运行单个包的测试

```bash
# 共享工具包
pnpm -C packages/shared test

# 游戏逻辑包
pnpm -C packages/games test

# 信令服务包
pnpm -C packages/signaling test

# Web 前端包
pnpm -C packages/web test
```

### 监听模式（开发时使用）

```bash
cd packages/games
npx vitest
```

### 生成覆盖率报告

```bash
cd packages/games
npx vitest --coverage
```

## 测试分类

### 1. 单元测试

#### 游戏引擎测试 (`packages/games/tests/duel-snake.test.ts`)

测试贪吃蛇游戏的核心逻辑：
- 蛇的移动
- 碰撞检测
- 得分系统
- 获胜条件

```typescript
describe('DuelSnakeGame', () => {
  it('moves snake in the correct direction', () => {
    const game = new DuelSnakeGame({ seed: 'test' });
    game.setPlayerReady('p1', true);
    game.setPlayerReady('p2', true);
    game.start();
    
    const initialHead = game.getState().players.p1.segments[0];
    game.queueInput('p1', 'right');
    game.tick();
    
    const newHead = game.getState().players.p1.segments[0];
    expect(newHead.x).toBe(initialHead.x + 1);
  });
});
```

#### 在线同步测试 (`packages/games/tests/duel-snake-online.test.ts`)

测试 Host/Guest 同步逻辑：
- 准备状态同步
- 输入传输
- 状态广播

```typescript
describe('DuelSnakeOnlineHost', () => {
  it('broadcasts state after each tick', () => {
    const [hostChannel, guestChannel] = createLinkedRealtimeEndpoints();
    const host = new DuelSnakeOnlineHost({ channel: hostChannel });
    
    // 验证状态广播
  });
});
```

### 2. 协议测试

#### 信令协议测试 (`packages/signaling/tests/protocol.test.ts`)

测试信令消息格式和房间管理逻辑：
- 消息序列化
- 房间状态管理
- 消息转发

```typescript
describe('Signaling protocol', () => {
  it('serializes all message types correctly', () => {
    const messages = [
      { type: 'join', role: 'host' },
      { type: 'room-ready' },
      { type: 'game', payload: { direction: 'up' } },
    ];
    
    for (const msg of messages) {
      expect(() => JSON.stringify(msg)).not.toThrow();
    }
  });
});
```

### 3. 组件测试

#### React 组件测试 (`packages/games/tests/duel-snake-react.test.tsx`)

测试游戏 UI 组件的渲染和交互：

```typescript
describe('DuelSnakeExperience', () => {
  it('renders and transitions to running state', async () => {
    render(<DuelSnakeExperience />);
    
    // 点击开始按钮
    fireEvent.click(screen.getByText('开始游戏'));
    
    // 验证游戏状态
    await waitFor(() => {
      expect(screen.getByText(/游戏进行中/)).toBeInTheDocument();
    });
  });
});
```

### 4. 集成测试

#### 页面测试 (`packages/web/app/**/*.test.tsx`)

测试 Next.js 页面的渲染：

```typescript
describe('GamePage', () => {
  it('renders game page with correct title', () => {
    render(<GamePage params={{ gameId: 'duel-snake' }} />);
    expect(screen.getByText('Duel Snake')).toBeInTheDocument();
  });
});
```

## 测试目录结构

```
packages/
├── games/
│   └── tests/
│       ├── duel-snake.test.ts        # 游戏引擎单元测试
│       ├── duel-snake-online.test.ts # 在线同步测试
│       ├── duel-snake-react.test.tsx # React 组件测试
│       └── index.test.ts             # 导出测试
├── shared/
│   └── tests/
│       ├── realtime.test.ts          # 实时通道测试
│       ├── webrtc.test.ts            # WebRTC 相关测试
│       ├── websocket-relay.test.ts   # WebSocket 中继测试
│       └── index.test.ts             # 导出测试
├── signaling/
│   └── tests/
│       └── protocol.test.ts          # 信令协议测试
└── web/
    └── app/
        ├── layout.test.tsx           # 布局测试
        ├── page.test.tsx             # 首页测试
        └── games/[gameId]/
            └── page.test.tsx         # 游戏页测试
```

## Mock 策略

### 模拟 WebSocket

```typescript
class MockWebSocket {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  
  send(data: string) {
    this.sentMessages.push(data);
  }
  
  close() {
    this.readyState = 3; // CLOSED
  }
}
```

### 模拟实时通道

```typescript
import { createLinkedRealtimeEndpoints } from '@pvp-games/shared';

// 创建一对互联的内存通道用于测试
const [hostChannel, guestChannel] = createLinkedRealtimeEndpoints();
```

### 模拟 Cloudflare 环境

信令服务的完整集成测试需要使用 Miniflare 或 `wrangler dev`：

```bash
# 启动本地 Cloudflare 环境
pnpm dev:signaling

# 在另一个终端运行集成测试
curl http://localhost:8787/health
```

## 测试最佳实践

### 1. 保持测试独立

每个测试应该是独立的，不依赖其他测试的执行顺序。

### 2. 使用描述性命名

```typescript
// ✅ 好
it('moves snake right when right arrow is pressed', () => {});

// ❌ 不好
it('test movement', () => {});
```

### 3. 测试边界情况

```typescript
describe('collision detection', () => {
  it('detects wall collision at left edge', () => {});
  it('detects wall collision at right edge', () => {});
  it('detects self collision', () => {});
  it('detects collision with other snake', () => {});
});
```

### 4. 使用固定种子

游戏测试使用固定随机种子确保可重复性：

```typescript
const game = new DuelSnakeGame({ seed: 'test-seed-123' });
```

## CI/CD 集成

测试在 CI 中自动运行：

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: pnpm test
```

## 故障排除

### 测试超时

增加超时时间：

```typescript
it('long running test', async () => {
  // ...
}, { timeout: 10000 });
```

### 环境问题

确保使用正确的 Node.js 版本：

```bash
node -v  # 应该是 18+
```

### 清除缓存

```bash
rm -rf node_modules/.vitest
pnpm test
```
