# 前端技术路线文档：Custom Mahjong MiniProgram Frontend

> 用途：本文件用于指导 Codex 在 `frontend/` 文件夹中搭建微信小程序前端。  
> 目标：实现一个可连接后端、支持登录、房间、实时牌桌、AI 对局、断线重连、牌谱回放的麻将小程序前端。  
> 范围：本文件只覆盖微信小程序前端，不覆盖后端实现，也不覆盖模型训练实现。
> 麻将牌面资料可来自于：https://github.com/black-desk/mahjim
---

## 0. 前端定位

前端是用户交互层，只负责展示和输入，不负责规则裁决。

前端需要负责：

```text
1. 微信登录；
2. 用户会话管理；
3. 房间创建、加入、准备、开始；
4. 展示牌桌；
5. 展示自己的手牌、明牌、弃牌、分数；
6. 展示对手的公开信息；
7. 展示当前可执行动作；
8. 通过 WebSocket 提交动作；
9. 接收后端推送的 PlayerGameView；
10. 断线重连；
11. 展示结算结果；
12. 查看牌谱回放；
13. 处理加载、错误、超时和重试状态。
```

前端不负责：

```text
1. 发牌；
2. 摸牌；
3. 判断能否吃碰杠胡；
4. 判断动作是否合法；
5. 判断胡牌和结算；
6. 执行 AI 推理；
7. 保存完整 GameState；
8. 保存其他玩家暗手牌；
9. 修改后端状态。
```

核心原则：

```text
前端只提交动作意图；
后端返回权威状态；
前端永远不相信本地推演结果；
前端展示的所有牌局信息都来自后端的 PlayerGameView；
前端不能包含规则核心逻辑，最多只做 UI 层提示。
```

---

## 1. 推荐技术栈

### 1.1 默认技术栈

推荐使用：

```text
微信原生小程序
TypeScript
WXML / WXSS
TDesign Miniprogram
原生 wx.request
原生 wx.connectSocket
miniprogram-api-typings
ESLint + Prettier
Jest / miniprogram-simulate
miniprogram-ci
```

选择理由：

```text
微信原生小程序：最少抽象，最贴近小程序运行环境；
TypeScript：适合维护复杂对局状态和协议类型；
TDesign Miniprogram：提供按钮、弹窗、Toast、Tab、Loading 等通用组件；
原生 WebSocket：与后端 ws 协议直接对齐；
miniprogram-api-typings：补充微信小程序 API 类型；
miniprogram-ci：后续可做自动上传、预览和构建。
```

### 1.2 为什么第一版不建议用 Taro / uni-app

第一版不建议引入跨端框架，原因是：

```text
1. 当前目标只面向微信小程序；
2. 麻将牌桌交互比较定制化；
3. WebSocket、页面生命周期和小程序调试需要贴近原生；
4. Codex 生成原生项目更容易和微信开发者工具对齐；
5. 避免跨端框架引入额外构建和兼容问题。
```

如果后期要支持 H5 或 App，可以再迁移到 Taro / uni-app。

### 1.3 牌桌渲染方式

第一版建议：

```text
牌桌主体：WXML 组件 + WXSS 布局；
牌牌样式：图片资源或纯 CSS 卡牌；
动画效果：CSS transition / animation；
Canvas：只作为可选的特效层或回放轨迹层。
```

不建议第一版全 Canvas 绘制牌桌。  
原因：

```text
1. 组件交互更好写；
2. 点击区域更清晰；
3. 文本、弹窗、按钮更好维护；
4. 调试更容易；
5. 牌桌元素数量有限，组件渲染足够。
```

---

## 2. 总体架构

```text
微信小程序前端
  │
  ├── 页面层 pages/
  │     ├── 登录页
  │     ├── 首页
  │     ├── 房间页
  │     ├── 牌桌页
  │     ├── 结算页
  │     └── 回放页
  │
  ├── 组件层 components/
  │     ├── 牌组件
  │     ├── 手牌区
  │     ├── 弃牌区
  │     ├── 玩家座位
  │     ├── 动作面板
  │     ├── 牌桌面板
  │     └── 结果弹窗
  │
  ├── 状态层 stores/
  │     ├── authStore
  │     ├── roomStore
  │     ├── gameStore
  │     └── wsStore
  │
  ├── 服务层 services/
  │     ├── http
  │     ├── websocket
  │     ├── authApi
  │     ├── roomApi
  │     ├── gameApi
  │     └── replayApi
  │
  └── 协议与类型层 types/
        ├── api.types
        ├── game.types
        ├── ws.types
        └── tile.types
```

整体数据流：

```text
用户点击牌 / 动作按钮
        ↓
页面组件触发事件
        ↓
gameStore.submitAction()
        ↓
wsClient.send(GAME_ACTION)
        ↓
后端校验并更新状态
        ↓
后端推送 GAME_VIEW / GAME_EVENTS
        ↓
wsClient 收到消息
        ↓
gameStore 更新 PlayerGameView
        ↓
页面自动刷新
```

---

## 3. 推荐目录结构

Codex 应在 `frontend/` 文件夹中实现如下结构：

```text
frontend/
├── README.md
├── package.json
├── project.config.json
├── project.private.config.json
├── tsconfig.json
├── app.ts
├── app.json
├── app.wxss
├── sitemap.json
├── miniprogram_npm/
├── assets/
│   ├── tiles/
│   │   ├── tile_0.png
│   │   ├── tile_1.png
│   │   └── ...
│   ├── icons/
│   ├── backgrounds/
│   └── sounds/
├── config/
│   ├── env.ts
│   └── constants.ts
├── types/
│   ├── api.types.ts
│   ├── auth.types.ts
│   ├── room.types.ts
│   ├── game.types.ts
│   ├── ws.types.ts
│   └── tile.types.ts
├── services/
│   ├── http.ts
│   ├── ws-client.ts
│   ├── auth-api.ts
│   ├── room-api.ts
│   ├── game-api.ts
│   └── replay-api.ts
├── stores/
│   ├── auth-store.ts
│   ├── room-store.ts
│   ├── game-store.ts
│   └── ws-store.ts
├── utils/
│   ├── storage.ts
│   ├── format.ts
│   ├── throttle.ts
│   ├── event-bus.ts
│   ├── tile-utils.ts
│   └── error.ts
├── components/
│   ├── tile-card/
│   │   ├── tile-card.ts
│   │   ├── tile-card.json
│   │   ├── tile-card.wxml
│   │   └── tile-card.wxss
│   ├── hand-area/
│   ├── discard-area/
│   ├── meld-area/
│   ├── player-seat/
│   ├── action-panel/
│   ├── game-board/
│   ├── score-panel/
│   ├── room-seat-list/
│   ├── result-modal/
│   ├── loading-mask/
│   └── connection-status/
├── pages/
│   ├── login/
│   │   ├── login.ts
│   │   ├── login.json
│   │   ├── login.wxml
│   │   └── login.wxss
│   ├── home/
│   ├── room/
│   ├── game/
│   ├── result/
│   ├── replay-list/
│   └── replay/
├── tests/
│   ├── tile-utils.test.ts
│   ├── ws-client.test.ts
│   ├── game-store.test.ts
│   └── protocol.test.ts
└── docs/
    ├── frontend_architecture.md
    ├── pages.md
    ├── websocket_protocol.md
    ├── ui_components.md
    └── assets.md
```

---

## 4. 页面设计

### 4.1 Login Page

路径：

```text
pages/login
```

职责：

```text
1. 调用 wx.login 获取 code；
2. 调用后端 /api/auth/wechat-login；
3. 保存 token 和 user；
4. 跳转 home。
```

交互：

```text
进入页面自动检查本地 token；
token 有效则跳转 home；
token 无效则展示登录按钮；
登录失败展示错误提示。
```

### 4.2 Home Page

路径：

```text
pages/home
```

职责：

```text
1. 展示用户信息；
2. 创建房间；
3. 输入房间号加入；
4. 查看历史牌谱；
5. 进入设置页。
```

核心按钮：

```text
创建房间
加入房间
查看回放
退出登录
```

### 4.3 Room Page

路径：

```text
pages/room
```

职责：

```text
1. 展示房间号；
2. 展示 4 个座位；
3. 房主可以添加 AI；
4. 玩家可以准备；
5. 房主开始游戏；
6. 监听房间 WebSocket 状态。
```

显示内容：

```text
房间号
座位列表
玩家昵称 / AI 名称
准备状态
房主标识
开始游戏按钮
添加 AI 按钮
```

### 4.4 Game Page

路径：

```text
pages/game
```

职责：

```text
1. 建立或恢复 WebSocket 订阅；
2. 展示 PlayerGameView；
3. 展示当前合法动作；
4. 用户点击牌或按钮提交动作；
5. 展示后端事件；
6. 展示连接状态；
7. 处理断线重连；
8. 终局后跳转 Result Page。
```

这是最核心页面。

### 4.5 Result Page

路径：

```text
pages/result
```

职责：

```text
1. 展示终局分数；
2. 展示赢家；
3. 展示本局简要统计；
4. 提供返回房间、再来一局、查看回放按钮。
```

### 4.6 Replay Page

路径：

```text
pages/replay
```

职责：

```text
1. 加载某局牌谱；
2. 按 step 播放；
3. 支持上一手 / 下一手；
4. 支持自动播放；
5. 只展示公开信息和用户可见视角。
```

---

## 5. 核心类型定义

文件：

```text
types/game.types.ts
```

### 5.1 Tile

```ts
export type TileId = number;
```

第一版直接用数字表示牌型。  
显示名称由前端映射：

```ts
export interface TileMeta {
  id: TileId;
  label: string;
  image: string;
  suit?: string;
  rank?: number;
}
```

### 5.2 GameAction

动作编码必须与后端和训练侧一致。

```ts
export type ActionType =
  | 'DISCARD'
  | 'PASS'
  | 'WIN'
  | 'PONG'
  | 'CHOW_LEFT'
  | 'CHOW_MIDDLE'
  | 'CHOW_RIGHT'
  | 'KONG_EXPOSED'
  | 'KONG_CONCEALED'
  | 'KONG_ADDED';

export interface GameAction {
  type: ActionType;
  tile?: TileId;
  actionId: number;
  extra?: Record<string, unknown>;
}
```

### 5.3 PlayerGameView

前端只接收后端的玩家视角。

```ts
export interface PlayerGameView {
  roomId: string;
  gameId: string;
  playerIndex: number;
  status: 'INIT' | 'PLAYING' | 'WAITING_RESPONSE' | 'FINISHED';
  stepIndex: number;

  dealer: number;
  currentPlayer: number;
  scores: number[];

  self: {
    hand: TileId[];
    melds: Meld[];
    discards: TileId[];
  };

  opponents: Array<{
    seatIndex: number;
    handCount: number;
    melds: Meld[];
    discards: TileId[];
    status: string;
    isAI?: boolean;
    nickname?: string;
  }>;

  lastDiscard?: {
    tile: TileId;
    fromPlayer: number;
  };

  legalActions: GameAction[];

  pendingResponses?: PendingResponse[];

  result?: ScoreResult;
}
```

### 5.4 Meld

```ts
export interface Meld {
  type: 'CHOW' | 'PONG' | 'KONG_EXPOSED' | 'KONG_CONCEALED' | 'KONG_ADDED';
  tiles: TileId[];
  fromPlayer?: number;
  stepIndex: number;
}
```

---

## 6. HTTP 服务层

文件：

```text
services/http.ts
```

### 6.1 基础封装

Codex 应实现一个统一的 `request` 方法：

```ts
export async function request<T>(
  options: RequestOptions
): Promise<T> {
  ...
}
```

功能：

```text
1. 自动拼接 API_BASE_URL；
2. 自动添加 Authorization: Bearer <token>；
3. 统一处理 401；
4. 统一处理业务错误；
5. 支持 loading 配置；
6. 支持 timeout；
7. 支持 GET / POST / PUT / DELETE；
8. 输出泛型类型。
```

### 6.2 API 模块

#### Auth API

```ts
export async function wechatLogin(input: {
  code: string;
  nickname?: string;
  avatarUrl?: string;
}): Promise<LoginResult>;
```

#### Room API

```ts
export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult>;
export async function joinRoom(roomId: string, seatIndex?: number): Promise<RoomView>;
export async function leaveRoom(roomId: string): Promise<void>;
export async function addAi(roomId: string, seatIndex: number, model?: string): Promise<RoomView>;
export async function startGame(roomId: string): Promise<StartGameResult>;
export async function getRoom(roomId: string): Promise<RoomView>;
```

#### Game API

```ts
export async function getGameView(gameId: string): Promise<PlayerGameView>;
export async function submitAction(gameId: string, action: ClientAction): Promise<ActionResult>;
```

#### Replay API

```ts
export async function listReplays(): Promise<ReplaySummary[]>;
export async function getReplay(gameId: string): Promise<ReplayDetail>;
```

---

## 7. WebSocket 客户端设计

文件：

```text
services/ws-client.ts
```

### 7.1 设计目标

WebSocket 客户端需要支持：

```text
1. 带 token 连接；
2. 自动重连；
3. 心跳；
4. 请求 requestId；
5. ACK / ERROR 处理；
6. room subscribe；
7. 消息分发；
8. 断线状态通知；
9. 页面隐藏时保持或关闭连接；
10. 页面恢复时重连并同步状态。
```

### 7.2 WsMessage 类型

```ts
export interface WsMessage<T = unknown> {
  type: string;
  requestId?: string;
  roomId?: string;
  gameId?: string;
  payload?: T;
  ts?: number;
}
```

### 7.3 客户端发送消息

```ts
wsClient.send({
  type: 'GAME_ACTION',
  roomId,
  gameId,
  payload: {
    type: 'DISCARD',
    tile: 12,
    clientSeq: 36,
  },
});
```

### 7.4 服务端消息类型

前端至少处理：

```text
ACK
ERROR
ROOM_UPDATE
GAME_VIEW
GAME_EVENTS
PONG
FORCE_REFRESH
```

### 7.5 自动重连策略

建议：

```text
首次断线：立即重连；
之后指数退避：1s、2s、4s、8s；
最大间隔：10s；
最大重试次数：不限，但页面显示“正在重连”；
重连成功后自动重新订阅当前 room；
重新调用 getGameView 获取权威视角。
```

### 7.6 心跳策略

```text
每 20 秒发送 PING；
10 秒内未收到 PONG 标记连接异常；
连续失败 2 次主动重连。
```

### 7.7 WebSocket 类骨架

```ts
export class WsClient {
  private socket: WechatMiniprogram.SocketTask | null = null;
  private connected = false;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private listeners = new Map<string, Set<(msg: WsMessage) => void>>();

  connect(token: string): void {
    ...
  }

  disconnect(): void {
    ...
  }

  send<T>(msg: WsMessage<T>): void {
    ...
  }

  on(type: string, handler: (msg: WsMessage) => void): void {
    ...
  }

  off(type: string, handler: (msg: WsMessage) => void): void {
    ...
  }

  subscribeRoom(roomId: string): void {
    ...
  }

  private startHeartbeat(): void {
    ...
  }

  private scheduleReconnect(): void {
    ...
  }
}
```

---

## 8. 状态管理设计

第一版不需要引入 Redux/MobX。  
建议使用轻量 store 单例 + 事件通知。

### 8.1 AuthStore

文件：

```text
stores/auth-store.ts
```

职责：

```text
保存 token；
保存 user；
执行 login；
执行 logout；
从 storage 恢复会话；
处理 401。
```

接口：

```ts
class AuthStore {
  token: string | null;
  user: User | null;

  init(): Promise<void>;
  login(): Promise<void>;
  logout(): void;
  isLoggedIn(): boolean;
}
```

### 8.2 RoomStore

职责：

```text
保存当前 room；
创建房间；
加入房间；
添加 AI；
开始游戏；
接收 ROOM_UPDATE。
```

### 8.3 GameStore

职责：

```text
保存当前 PlayerGameView；
保存最近事件；
保存连接状态；
提交动作；
处理 GAME_VIEW；
处理 GAME_EVENTS；
处理终局跳转。
```

接口：

```ts
class GameStore {
  view: PlayerGameView | null;
  events: GameEvent[];
  selectedTile: TileId | null;
  submitting: boolean;

  setView(view: PlayerGameView): void;
  selectTile(tile: TileId): void;
  submitDiscard(tile: TileId): Promise<void>;
  submitAction(action: GameAction): Promise<void>;
  canSubmitAction(action: GameAction): boolean;
  getLegalDiscardTiles(): TileId[];
}
```

注意：

```text
canSubmitAction 只用于 UI 控制；
最终是否合法仍以后端为准。
```

### 8.4 WsStore

职责：

```text
连接 WebSocket；
断线重连；
订阅 room；
分发消息到 roomStore / gameStore；
维护连接状态。
```

连接状态：

```ts
export type WsStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';
```

---

## 9. 牌桌 UI 设计

### 9.1 Game Page 布局

建议竖屏优先，兼容不同屏幕：

```text
┌──────────────────────────────┐
│ 顶部：房间号 / 连接状态 / 菜单  │
├──────────────────────────────┤
│          上家区域              │
│   左家区域   桌面区   右家区域  │
│          自己弃牌区            │
├──────────────────────────────┤
│          自己手牌区            │
├──────────────────────────────┤
│          动作按钮区            │
└──────────────────────────────┘
```

如果需要更接近真实麻将桌，可以用四边布局：

```text
          opponent-2
opponent-1   center   opponent-3
             self
```

### 9.2 组件拆分

#### game-board

负责组合整个牌桌：

```text
player-seat x 3
self area
discard areas
score panel
last discard marker
```

#### tile-card

负责显示一张牌：

```text
正面牌；
背面牌；
选中状态；
不可点击状态；
横向 / 竖向；
小尺寸 / 中尺寸 / 大尺寸。
```

属性：

```ts
properties: {
  tile: Number,
  faceDown: Boolean,
  selected: Boolean,
  disabled: Boolean,
  size: String,
  orientation: String
}
```

#### hand-area

负责显示自己的手牌：

```text
按 tile 排序；
点击选择牌；
再次点击或点击出牌按钮提交；
合法出牌高亮；
不可出牌置灰。
```

#### action-panel

负责展示合法动作：

```text
胡
碰
杠
吃
过
出牌
```

只显示后端返回的 legalActions。

#### player-seat

显示对手信息：

```text
昵称；
是否 AI；
手牌数量；
明牌；
弃牌；
分数；
当前行动标识；
离线状态。
```

#### result-modal

显示终局结果：

```text
赢家；
每家分数变化；
胡牌类型；
返回房间；
查看回放。
```

---

## 10. 动作交互设计

### 10.1 出牌交互

流程：

```text
1. 用户点击一张手牌；
2. 如果该牌在 legalDiscardTiles 中，则选中；
3. 再次点击同一张牌，提交 DISCARD；
4. 或点击“出牌”按钮提交；
5. 提交期间禁用所有动作；
6. 后端返回 GAME_VIEW 后解除禁用。
```

### 10.2 响应动作

当后端返回 legalActions 中包含：

```text
WIN
PONG
CHOW_LEFT
CHOW_MIDDLE
CHOW_RIGHT
KONG_EXPOSED
PASS
```

前端显示 action-panel。

用户点击按钮后发送：

```json
{
  "type": "GAME_ACTION",
  "payload": {
    "type": "PONG",
    "clientSeq": 37
  }
}
```

### 10.3 防重复点击

前端必须处理：

```text
提交动作后设置 submitting = true；
直到收到 ACK / ERROR / GAME_VIEW 后恢复；
按钮增加 loading 状态；
同一个 clientSeq 不重复发送；
如果网络失败，提示用户重试或等待重连。
```

### 10.4 动作合法性

前端可以用 legalActions 做 UI 层过滤，但不能自己判断规则。

正确：

```text
只显示 legalActions 中存在的动作。
```

错误：

```text
前端根据手牌自行判断能不能碰、能不能胡。
```

---

## 11. 连接状态与断线重连

### 11.1 显示连接状态

页面顶部显示：

```text
已连接
正在重连
连接失败
离线
```

### 11.2 断线时行为

```text
1. 禁止提交动作；
2. 保留当前视图；
3. 显示重连浮层；
4. 自动重连；
5. 重连成功后重新订阅 room；
6. 重新拉取 getGameView；
7. 用后端最新视角覆盖本地状态。
```

### 11.3 小程序生命周期处理

在 `app.ts` 中处理：

```ts
App({
  onLaunch() {},
  onShow() {
    // 恢复 WebSocket
  },
  onHide() {
    // 可保留连接，也可暂停心跳，视后端策略而定
  }
});
```

在 game 页面中处理：

```ts
onLoad() {
  // 初始化 roomId / gameId
}

onShow() {
  // 确保 ws connected and subscribed
}

onUnload() {
  // 取消页面级 listeners
}
```

---

## 12. 前端与后端协议对齐

### 12.1 HTTP API

前端应调用以下后端接口：

```text
POST /api/auth/wechat-login
POST /api/rooms
POST /api/rooms/:roomId/join
POST /api/rooms/:roomId/leave
POST /api/rooms/:roomId/add-ai
POST /api/rooms/:roomId/start
GET  /api/rooms/:roomId
GET  /api/games/:gameId/view
POST /api/games/:gameId/actions
GET  /api/replays/:gameId
```

### 12.2 WebSocket

连接：

```text
wss://your-domain.com/ws?token=<jwt>
```

本地：

```text
ws://localhost:3000/ws?token=<jwt>
```

发送：

```json
{
  "type": "ROOM_SUBSCRIBE",
  "requestId": "req_001",
  "roomId": "room_001"
}
```

```json
{
  "type": "GAME_ACTION",
  "requestId": "req_002",
  "roomId": "room_001",
  "gameId": "game_001",
  "payload": {
    "type": "DISCARD",
    "tile": 12,
    "clientSeq": 36
  }
}
```

接收：

```json
{
  "type": "GAME_VIEW",
  "roomId": "room_001",
  "gameId": "game_001",
  "payload": {
    "view": {}
  }
}
```

```json
{
  "type": "ERROR",
  "requestId": "req_002",
  "payload": {
    "code": "ILLEGAL_ACTION",
    "message": "Action is not legal in current state."
  }
}
```

---

## 13. Tile 资源与显示

### 13.1 图片命名

建议：

```text
assets/tiles/tile_0.png
assets/tiles/tile_1.png
...
assets/tiles/tile_33.png
assets/tiles/tile_back.png
```

如果自定义麻将牌型不是 34 种，则按后端 tile id 对应生成：

```text
tile_{tileId}.png
```

### 13.2 Tile 映射

文件：

```text
utils/tile-utils.ts
```

```ts
export function getTileImage(tile: TileId): string {
  return `/assets/tiles/tile_${tile}.png`;
}

export function getTileLabel(tile: TileId): string {
  ...
}

export function sortTiles(tiles: TileId[]): TileId[] {
  ...
}
```

### 13.3 不要在前端写复杂规则

前端可以排序和显示名称，但不能判断：

```text
是否成顺子；
是否成刻子；
是否可以胡；
是否可以杠。
```

这些必须由后端决定。

---

## 14. 样式规范

### 14.1 尺寸单位

推荐使用：

```text
rpx
```

用于适配不同手机屏幕。

### 14.2 颜色建议

```text
背景：深绿色或暗色桌面；
牌面：白色 / 米白；
主要文字：#1f2937；
辅助文字：#6b7280；
危险动作：红色；
可执行动作：蓝色或金色；
禁用动作：灰色。
```

### 14.3 状态样式

需要覆盖：

```text
当前行动玩家高亮；
选中手牌上移；
可出牌高亮；
不可出牌置灰；
最新弃牌高亮；
AI 玩家标识；
离线玩家半透明；
连接异常浮层。
```

---

## 15. 声音与动画

第一版可选，不作为核心依赖。

### 15.1 声音

可支持：

```text
出牌音效；
吃碰杠胡音效；
胜利音效；
按钮点击音效。
```

注意：

```text
音频资源不要过大；
默认允许用户关闭音效；
遵守小程序音频播放限制。
```

### 15.2 动画

优先使用 CSS 动画：

```text
出牌轻微移动；
选牌上移；
最新弃牌闪烁；
结算弹窗渐入。
```

不建议第一版写复杂 Canvas 动画。

---

## 16. Mock 模式

前端需要支持无后端开发模式，方便 Codex 和 UI 调试。

配置：

```ts
export const USE_MOCK_API = false;
export const USE_MOCK_WS = false;
```

### 16.1 Mock API

文件：

```text
services/mock/
```

模拟：

```text
登录；
创建房间；
加入房间；
开始游戏；
获取 game view；
提交动作。
```

### 16.2 Mock WebSocket

MockWsClient 应该支持：

```text
ROOM_SUBSCRIBE；
GAME_ACTION；
定时推送 GAME_VIEW；
模拟 ERROR；
模拟断线重连。
```

Mock 模式的目的：

```text
让前端 UI 在后端未完成时可以独立开发；
让组件测试不依赖真实网络；
让 Codex 生成页面后可以看到基本效果。
```

---

## 17. 错误处理

统一错误展示：

```text
Toast：短错误；
Modal：严重错误；
页面级 empty/error state：加载失败；
连接状态组件：网络错误。
```

常见错误处理：

```text
401：清除 token，跳转登录；
ROOM_NOT_FOUND：返回首页；
ROOM_FULL：提示房间已满；
NOT_YOUR_TURN：刷新当前视图；
ILLEGAL_ACTION：提示动作无效并刷新；
STATE_VERSION_CONFLICT：刷新当前视图；
WS_DISCONNECTED：显示重连。
```

---

## 18. 安全边界

### 18.1 前端不保存敏感数据

本地 storage 只保存：

```text
token；
user 基本信息；
最近 roomId；
用户设置。
```

不要保存：

```text
微信 session_key；
完整 GameState；
其他玩家暗手牌；
后端密钥；
AI 服务地址密钥。
```

### 18.2 防作弊

前端不能通过隐藏 UI 防作弊，真正防作弊在后端。  
但前端应避免暴露不该显示的信息：

```text
不要在 console 输出完整 view 以外的数据；
不要在页面 data 中存完整 GameState；
不要接收或渲染其他玩家暗手牌字段。
```

---

## 19. 测试要求

### 19.1 单元测试

至少测试：

```text
tile-utils；
action 映射；
ws message parser；
http error handler；
game-store legal action filtering；
断线重连状态机。
```

### 19.2 组件测试

至少测试：

```text
tile-card 正反面显示；
hand-area 选牌；
action-panel 只显示合法动作；
player-seat 手牌数量显示；
connection-status 状态切换。
```

### 19.3 页面手工验收

必须手工跑通：

```text
登录；
创建房间；
加入 AI；
开始游戏；
展示手牌；
点击出牌；
接收 AI 出牌；
断网重连；
终局结算；
查看回放。
```

### 19.4 协议测试

前端需要保存一份协议 fixtures：

```text
fixtures/game_view_sample.json
fixtures/room_update_sample.json
fixtures/error_sample.json
```

用这些 fixtures 测试页面渲染，保证后端还没完成时也能开发。

---

## 20. 配置文件

文件：

```text
config/env.ts
```

示例：

```ts
export const ENV = {
  API_BASE_URL: 'http://localhost:3000/api',
  WS_BASE_URL: 'ws://localhost:3000/ws',
  USE_MOCK_API: false,
  USE_MOCK_WS: false,
  REQUEST_TIMEOUT_MS: 10000,
  WS_HEARTBEAT_INTERVAL_MS: 20000,
  WS_PONG_TIMEOUT_MS: 10000,
};
```

生产环境：

```ts
export const ENV = {
  API_BASE_URL: 'https://your-domain.com/api',
  WS_BASE_URL: 'wss://your-domain.com/ws',
  USE_MOCK_API: false,
  USE_MOCK_WS: false,
  REQUEST_TIMEOUT_MS: 10000,
  WS_HEARTBEAT_INTERVAL_MS: 20000,
  WS_PONG_TIMEOUT_MS: 10000,
};
```

---

## 21. app.json 配置

示例：

```json
{
  "pages": [
    "pages/login/login",
    "pages/home/home",
    "pages/room/room",
    "pages/game/game",
    "pages/result/result",
    "pages/replay-list/replay-list",
    "pages/replay/replay"
  ],
  "window": {
    "navigationBarTitleText": "Custom Mahjong",
    "navigationBarBackgroundColor": "#0f5132",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#0b3d2e"
  },
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-loading": "tdesign-miniprogram/loading/loading"
  }
}
```

---

## 22. package.json 脚本

Codex 应配置：

```json
{
  "scripts": {
    "build:npm": "echo \"Use WeChat DevTools to build npm\"",
    "lint": "eslint . --ext .ts",
    "test": "jest",
    "format": "prettier --write \"**/*.{ts,js,json,wxml,wxss,md}\"",
    "typecheck": "tsc --noEmit",
    "ci:preview": "miniprogram-ci preview",
    "ci:upload": "miniprogram-ci upload"
  }
}
```

---

## 23. Codex 开发顺序

请 Codex 按以下顺序实现，避免一开始堆复杂 UI。

### Step 1：初始化小程序项目

```text
创建 app.ts / app.json / app.wxss；
配置 TypeScript；
配置 package.json；
安装 tdesign-miniprogram；
安装 miniprogram-api-typings；
配置基础 pages。
```

验收：

```text
微信开发者工具能打开项目；
首页能显示；
npm 构建无错误。
```

### Step 2：实现类型定义

```text
types/game.types.ts；
types/ws.types.ts；
types/api.types.ts；
types/room.types.ts。
```

验收：

```text
tsc --noEmit 通过。
```

### Step 3：实现 HTTP 服务

```text
services/http.ts；
services/auth-api.ts；
services/room-api.ts；
services/game-api.ts；
services/replay-api.ts。
```

验收：

```text
能 mock login；
能请求 health；
错误能统一提示。
```

### Step 4：实现 WebSocket 客户端

```text
connect；
disconnect；
send；
on/off；
heartbeat；
reconnect；
subscribeRoom。
```

验收：

```text
能连接后端 ws；
能发送 PING；
能收到 PONG；
断线后会重连。
```

### Step 5：实现 Store

```text
authStore；
roomStore；
gameStore；
wsStore。
```

验收：

```text
页面可以读取 store 状态；
GAME_VIEW 可以更新 gameStore。
```

### Step 6：实现基础组件

```text
tile-card；
hand-area；
discard-area；
player-seat；
action-panel；
connection-status。
```

验收：

```text
使用 fixture 能渲染完整牌桌；
点击手牌能触发事件；
action-panel 只显示合法动作。
```

### Step 7：实现页面

```text
login；
home；
room；
game；
result；
replay。
```

验收：

```text
mock 模式下能完整跑通：
登录 → 创建房间 → 加 AI → 开始游戏 → 出牌 → 结算。
```

### Step 8：联调后端

```text
关闭 mock；
连接本地 backend；
登录；
创建房间；
加入 AI；
开始游戏；
WebSocket 提交动作；
接收 GAME_VIEW。
```

### Step 9：优化体验

```text
loading；
toast；
错误页；
断线重连浮层；
出牌动画；
结算弹窗。
```

### Step 10：测试和文档

```text
补充 fixtures；
补充 store 测试；
补充 ws-client 测试；
补充 README。
```

---

## 24. 最小可运行闭环

前端第一版必须支持：

```text
1. 打开小程序；
2. mock 或真实微信登录；
3. 创建房间；
4. 添加 3 个 AI；
5. 开始游戏；
6. 进入牌桌；
7. 显示自己的手牌；
8. 显示对手手牌数量、明牌、弃牌；
9. 显示 legalActions；
10. 点击手牌出牌；
11. 后端处理后推送 GAME_VIEW；
12. AI 自动行动后继续刷新；
13. 终局后展示 Result；
14. 可以查看 Replay。
```

---

## 25. 与后端接口的关键约束

前端必须遵守：

```text
1. 只展示后端返回的 PlayerGameView；
2. 不保存完整 GameState；
3. 不自行判断规则；
4. 不显示其他玩家暗手牌；
5. 所有动作都通过后端提交；
6. 提交动作后等待后端确认；
7. WebSocket 断线后必须拉取最新 view；
8. 后端 ERROR 后必须刷新当前 view；
9. actionId / tileId 必须与后端一致；
10. 游戏结束以后端 status=FINISHED 为准。
```

---

## 26. 常见实现细节

### 26.1 如何判断某张牌能不能出

不要自己判断规则。  
只从 `view.legalActions` 中筛选：

```ts
function getLegalDiscardTiles(view: PlayerGameView): TileId[] {
  return view.legalActions
    .filter(action => action.type === 'DISCARD' && action.tile !== undefined)
    .map(action => action.tile!);
}
```

### 26.2 如何提交出牌

```ts
async function submitDiscard(tile: TileId) {
  const action = view.legalActions.find(
    item => item.type === 'DISCARD' && item.tile === tile
  );

  if (!action) {
    showToast('当前不能打出这张牌');
    return;
  }

  wsClient.send({
    type: 'GAME_ACTION',
    requestId: createRequestId(),
    roomId: view.roomId,
    gameId: view.gameId,
    payload: {
      type: 'DISCARD',
      tile,
      actionId: action.actionId,
      clientSeq: view.stepIndex,
    },
  });
}
```

### 26.3 如何处理后端 ERROR

```ts
wsClient.on('ERROR', async msg => {
  showToast(msg.payload.message || '操作失败');
  if (gameStore.view?.gameId) {
    const latest = await getGameView(gameStore.view.gameId);
    gameStore.setView(latest);
  }
});
```

### 26.4 如何处理 GAME_VIEW

```ts
wsClient.on('GAME_VIEW', msg => {
  const view = msg.payload.view as PlayerGameView;
  gameStore.setView(view);

  if (view.status === 'FINISHED') {
    wx.navigateTo({
      url: `/pages/result/result?gameId=${view.gameId}`,
    });
  }
});
```

---

## 27. 资源文件要求

### 27.1 牌图

最小要求：

```text
tile_0.png ~ tile_N.png；
tile_back.png；
tile_unknown.png。
```

### 27.2 图标

```text
home.png；
room.png；
ai.png；
user.png；
connection.png；
settings.png。
```

### 27.3 声音

可选：

```text
discard.mp3；
pong.mp3；
win.mp3；
button.mp3。
```

第一版如果没有美术资源，可以先用纯 CSS 牌面。

---

## 28. 上线前检查清单

```text
[ ] 生产 API_BASE_URL 使用 https；
[ ] 生产 WS_BASE_URL 使用 wss；
[ ] 小程序后台已配置合法 request 域名；
[ ] 小程序后台已配置合法 socket 域名；
[ ] token 不在日志中明文输出；
[ ] 页面不会显示其他玩家暗手牌；
[ ] 断线重连可用；
[ ] 重连后会刷新最新 game view；
[ ] 操作按钮有防重复点击；
[ ] 后端 ERROR 能正确提示；
[ ] mock 模式可关闭；
[ ] 资源大小合理；
[ ] 真机测试通过；
[ ] 弱网测试通过；
[ ] iOS / Android 布局均正常；
[ ] 游戏结束能查看结算；
[ ] replay 能打开。
```

---

## 29. 后续增强路线

第一版完成后，可以继续做：

```text
1. 更精致的牌面和桌面美术；
2. 出牌飞行动画；
3. 吃碰杠胡语音；
4. 牌谱逐步回放动画；
5. 好友邀请分享卡片；
6. 排行榜；
7. 战绩统计；
8. AI 难度选择；
9. 断线自动托管提示；
10. 自定义规则配置页；
11. 新手引导；
12. 局内聊天或快捷表情；
13. 多套主题皮肤；
14. 性能优化和分包加载。
```

---

## 30. Codex 实现要求总结

请 Codex 基于本文档，在当前 `frontend/` 文件夹中实现微信小程序前端。

必须满足：

```text
1. 使用微信原生小程序；
2. 使用 TypeScript；
3. 使用 WXML / WXSS；
4. 使用 TDesign Miniprogram 作为基础 UI 组件；
5. 使用 wx.request 封装 HTTP 请求；
6. 使用 wx.connectSocket 封装 WebSocket；
7. 实现登录、首页、房间、牌桌、结算、回放页面；
8. 实现 tile-card、hand-area、action-panel、game-board 等核心组件；
9. 前端只展示 PlayerGameView；
10. 前端不实现规则判断；
11. 所有动作提交给后端；
12. 支持断线重连；
13. 支持 mock API / mock WS；
14. 支持 fixtures 渲染牌桌；
15. 支持基础测试。
```

最终前端应支持：

```text
npm install
微信开发者工具打开 frontend/
构建 npm
运行小程序
mock login
→ 创建房间
→ 添加 AI
→ 开始游戏
→ 进入牌桌
→ 点击出牌
→ 接收 GAME_VIEW
→ 展示结算
→ 查看回放
```

---

## 31. 给 Codex 的一句话任务

请基于本文档，在 `frontend/` 文件夹中搭建一个微信原生小程序前端：实现登录、房间、实时牌桌、动作提交、WebSocket 状态同步、断线重连、结算和回放功能；第一版可以使用 Mock API / Mock WS 跑通 UI 闭环，但所有类型、动作编码和 PlayerGameView 必须与后端协议保持一致。
