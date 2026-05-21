# 后端接口预留表

本前端以“后端裁决、前端展示”为边界。曲靖飞小鸡规则 v1.5 中的小鸡万能、公开杠牌、吃碰杠胡优先级、振听/拒碰、流局、番种和结算均由后端判断，前端只提交用户意图并渲染 `PlayerGameView`。

## HTTP API

| 模块 | 方法 | 路径 | 前端用途 | 请求体 | 返回体 |
| --- | --- | --- | --- | --- | --- |
| Auth | POST | `/api/auth/wechat-login` | 微信登录换取业务 token | `{ code, nickname?, avatarUrl? }` | `{ token, user }` |
| Room | POST | `/api/rooms` | 创建房间 | `{ rules?: Partial<RoomRules> }` | `{ room }` |
| Room | POST | `/api/rooms/:roomId/join` | 加入房间 | `{ seatIndex? }` | `RoomView` |
| Room | POST | `/api/rooms/:roomId/leave` | 离开房间 | 空 | 空 |
| Room | POST | `/api/rooms/:roomId/add-ai` | 房主添加 AI | `{ seatIndex, model? }` | `RoomView` |
| Room | POST | `/api/rooms/:roomId/start` | 开始游戏 | 空 | `{ roomId, gameId }` |
| Room | GET | `/api/rooms/:roomId` | 刷新房间视图 | 空 | `RoomView` |
| Game | GET | `/api/games/:gameId/view` | 拉取权威玩家视角 | 空 | `PlayerGameView` |
| Game | POST | `/api/games/:gameId/actions` | 兜底动作提交 | `ClientAction` | `{ accepted, view?, message? }` |
| Replay | GET | `/api/replays` | 牌谱列表 | 空 | `ReplaySummary[]` |
| Replay | GET | `/api/replays/:gameId` | 牌谱详情 | 空 | `ReplayDetail` |

## WebSocket

连接地址：

| 环境 | 地址 |
| --- | --- |
| 本地 | `ws://localhost:3000/ws?token=<jwt>` |
| 生产 | `wss://your-domain.com/ws?token=<jwt>` |

客户端发送：

| type | 用途 | payload |
| --- | --- | --- |
| `PING` | 心跳 | 空 |
| `ROOM_SUBSCRIBE` | 订阅房间状态 | `{ roomId }` |
| `GAME_ACTION` | 提交动作意图 | `{ type, tile?, actionId, clientSeq, extra? }` |

服务端推送：

| type | 用途 | payload |
| --- | --- | --- |
| `ACK` | 确认请求已收到 | `{ requestId }` |
| `ERROR` | 请求或状态错误 | `{ code, message }` |
| `ROOM_UPDATE` | 房间更新 | `{ room }` |
| `GAME_VIEW` | 玩家权威视角 | `{ view }` |
| `GAME_EVENTS` | 最近事件流 | `{ events }` |
| `PONG` | 心跳响应 | 空 |
| `FORCE_REFRESH` | 要求前端重新拉取 | `{ gameId?, roomId? }` |

## 规则字段

| 字段 | 位置 | 说明 |
| --- | --- | --- |
| `rules.preset` | `RoomView` | 固定为 `qujing-fei-xiao-ji-v1.5` |
| `rules.allowChow` | `RoomView` | 部分玩法可禁吃 |
| `rules.fanCap` | `RoomView` | 通常三番封顶 |
| `publicKongTiles` | `PlayerGameView` | 当前公开两张杠牌 |
| `xiaoJiActiveAsWild` | `PlayerGameView` | 宣威玩法中小鸡失效时置 `false` |
| `restrictions` | `PlayerGameView` | 同巡振听、拒碰、小鸡拒和等限制提示 |
| `legalActions` | `PlayerGameView` | 当前玩家可执行动作，前端只展示这些动作 |
| `result.fanItems` | `ScoreResult` | 后端结算出的番种表 |

## 动作编码

| ActionType | 含义 |
| --- | --- |
| `DISCARD` | 出牌 |
| `PASS` | 过 |
| `WIN` | 胡牌 |
| `PONG` | 碰 |
| `CHOW_LEFT` / `CHOW_MIDDLE` / `CHOW_RIGHT` | 三种吃牌位置 |
| `KONG_EXPOSED` | 明杠 |
| `KONG_CONCEALED` | 暗杠 |
| `KONG_ADDED` | 加杠 |
| `SELECT_KONG_TILE` | 杠后从公开杠牌中取牌 |

## 后端必须保证

| 约束 | 说明 |
| --- | --- |
| 权威视图 | 前端不得收到其他玩家暗手牌 |
| 动作合法性 | 所有吃、碰、杠、胡、振听、流局、番种、包牌、诈和等判断由后端完成 |
| 幂等 | `requestId` 与 `clientSeq` 可用于防重复提交 |
| 重连恢复 | 前端重连后可通过 `GET /api/games/:gameId/view` 覆盖本地状态 |
| 结算一致 | `ScoreResult` 必须包含分数变化和番种明细 |
