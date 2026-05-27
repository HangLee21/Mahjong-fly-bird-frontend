# Backend API Contract

本文档描述 Cocos Creator 微信小游戏前端需要的后端接口。后端按此实现后，前端可把 `AppConfig.USE_MOCK_HTTP / USE_MOCK_WS` 改为 `false` 直接接入。

## 1. 基础约定

REST 基础地址：

```text
http://<host>/api
```

WebSocket 地址：

```text
ws://<host>/ws
```

HTTP Header：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

统一响应格式建议：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

当前前端 HTTP 客户端若未统一拆 `data`，也可以直接返回接口文档中的业务对象。推荐后端先支持统一格式，前端后续可统一适配。

错误响应：

```json
{
  "code": 40001,
  "message": "room not found",
  "data": null
}
```

## 2. 通用类型

### User

```json
{
  "id": "u_001",
  "nickname": "微信昵称",
  "avatarUrl": "https://..."
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 后端用户 ID |
| `nickname` | string | 是 | 微信昵称；未授权可返回 `游客` |
| `avatarUrl` | string | 否 | 微信头像 URL；没有则前端用 `default_avatar.png` |

### TileId

```text
number
```

前端目前使用 `0-33` 表示 34 种麻将牌面。建议后端固定牌面映射并提供同样的编号。

## 3. Auth

Boot、Lobby、RoomEntry 也依赖 Auth 状态：

- Boot 页面启动时需要判断本地 token 是否仍然有效。
- Lobby 页面需要显示当前用户身份、后续可显示历史房间/未完成房间。
- RoomEntry 页面创建或加入房间时必须携带登录态。

### GET `/auth/session`

启动页会话恢复接口。建议 Boot 页面有 token 时调用，用于确认 token 是否有效、拉取最新用户资料。

请求：

```http
GET /auth/session
Authorization: Bearer <token>
```

响应：

```json
{
  "valid": true,
  "user": {
    "id": "u_001",
    "nickname": "微信昵称",
    "avatarUrl": "https://..."
  }
}
```

token 无效：

```json
{
  "valid": false,
  "user": null
}
```

前端处理：

- `valid=true`：进入 Lobby。
- `valid=false`：清除本地 token，进入 Login。

### GET `/app/bootstrap`

启动配置接口。建议 Boot 页面进入 Lobby 前调用，用于后端控制规则版本、资源版本、维护状态。

响应：

```json
{
  "serverTime": 1710000000000,
  "maintenance": false,
  "minClientVersion": "0.1.0",
  "rulePreset": "qujing-fei-xiao-ji-v1.5",
  "assetVersion": "2026.05.27",
  "wsUrl": "ws://localhost:3000/ws",
  "notice": "欢迎体验曲靖飞小鸡"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `serverTime` | number | 服务端时间戳 |
| `maintenance` | boolean | 是否维护中 |
| `minClientVersion` | string | 最低客户端版本 |
| `rulePreset` | string | 当前规则版本 |
| `assetVersion` | string | 资源版本，可用于前端缓存控制 |
| `wsUrl` | string | WebSocket 地址 |
| `notice` | string | Lobby 可展示公告 |

### POST `/auth/wechat-login`

微信登录。

请求：

```json
{
  "code": "wx_login_code",
  "nickname": "微信昵称",
  "avatarUrl": "https://..."
}
```

响应：

```json
{
  "token": "jwt_or_session_token",
  "user": {
    "id": "u_001",
    "nickname": "微信昵称",
    "avatarUrl": "https://..."
  }
}
```

说明：

- `code` 来自微信小游戏登录。
- `nickname/avatarUrl` 可由前端授权后传入，也可由后端根据微信能力补充。

### POST `/auth/logout`

退出登录。可选接口。

请求：

```json
{}
```

响应：

```json
{
  "ok": true
}
```

## 3.1 Boot Scene 接口需求

Boot 页面职责：

1. 设置横屏；
2. 展示启动图；
3. 检查 token；
4. 进入 Lobby 或 Login。

当前已实现：

- 本地读取 token；
- mock 模式直接进 Lobby。

正式接后端建议流程：

```text
Boot
-> GET /app/bootstrap
-> 如果本地有 token：GET /auth/session
-> valid=true 进入 Lobby
-> valid=false 进入 Login
```

Boot 页面后端接口清单：

| 接口 | 必需 | 说明 |
| --- | --- | --- |
| `GET /app/bootstrap` | 建议 | 获取服务器时间、维护状态、规则版本、资源版本 |
| `GET /auth/session` | 建议 | 校验本地 token 是否有效 |
| `POST /auth/wechat-login` | 必需 | Login 页面完成微信登录 |

## 3.2 Lobby Scene 接口需求

Lobby 页面职责：

1. 展示游戏标题和开始入口；
2. 展示当前用户资料；
3. 进入 RoomEntry；
4. 后续可展示未完成房间、公告、历史入口。

当前 Lobby 只跳转 RoomEntry，不直接请求房间接口。建议后端提供 Lobby 摘要接口，方便后续扩展。

### GET `/lobby/summary`

获取大厅摘要。

响应：

```json
{
  "user": {
    "id": "u_001",
    "nickname": "微信昵称",
    "avatarUrl": "https://..."
  },
  "notice": "欢迎体验曲靖飞小鸡",
  "activeRoom": {
    "roomId": "886688",
    "status": "WAITING",
    "gameId": null
  },
  "recentRooms": [
    {
      "roomId": "886688",
      "gameId": "game_001",
      "finishedAt": 1710000000000,
      "title": "曲靖飞小鸡 886688"
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user` | User | 当前登录用户 |
| `notice` | string | 公告，可选 |
| `activeRoom` | object/null | 未结束房间，允许玩家断线重连 |
| `recentRooms` | array | 最近房间或回放入口 |

如果 `activeRoom` 不为空，前端可提供“继续房间”入口：

```json
{
  "roomId": "886688",
  "status": "PLAYING",
  "gameId": "game_001"
}
```

## 3.3 RoomEntry Scene 接口需求

RoomEntry 页面职责：

1. 输入 6 位房间号；
2. 创建房间；
3. 加入房间；
4. 返回 Lobby。

当前已使用：

- `POST /rooms`
- `POST /rooms/{roomId}/join`

建议补充房间号预检查，便于用户输入房间号后提前提示房间不存在、已满、已开局。

### GET `/rooms/{roomId}/preview`

房间号预检查。可选接口。

响应：

```json
{
  "exists": true,
  "roomId": "886688",
  "status": "WAITING",
  "seatCount": 2,
  "maxSeats": 4,
  "canJoin": true,
  "ownerNickname": "房主昵称",
  "rules": {
    "roundCount": 16,
    "fanCap": 3,
    "allowChow": true,
    "allowMultiWin": true,
    "publicKongTiles": 2
  }
}
```

房间不存在：

```json
{
  "exists": false,
  "roomId": "886688",
  "canJoin": false,
  "message": "房间不存在"
}
```

RoomEntry 页面后端接口清单：

| 接口 | 必需 | 说明 |
| --- | --- | --- |
| `POST /rooms` | 必需 | 创建房间 |
| `POST /rooms/{roomId}/join` | 必需 | 通过房间号加入 |
| `GET /rooms/{roomId}/preview` | 建议 | 输入房间号后预检查 |

## 4. Room

### RoomView

```json
{
  "roomId": "886688",
  "ownerId": "u_001",
  "status": "WAITING",
  "gameId": null,
  "rules": {
    "preset": "qujing-fei-xiao-ji-v1.5",
    "roundCount": 16,
    "allowChow": true,
    "fanCap": 3,
    "publicKongTiles": 2,
    "xiaoJiTile": "1-tiao",
    "drawMode": "fixed-wall-reserve",
    "allowMultiWin": true
  },
  "seats": [
    {
      "seatIndex": 0,
      "user": {
        "id": "u_001",
        "nickname": "玩家",
        "avatarUrl": "https://..."
      },
      "isAI": false,
      "isReady": true,
      "isOwner": true
    },
    {
      "seatIndex": 1,
      "isReady": false
    }
  ]
}
```

`status`：

```text
WAITING | PLAYING | FINISHED
```

`roundCount`：

```text
8 | 16 | 24 | 32
```

`drawMode`：

```text
fixed-wall-reserve | kong-count-threshold
```

### POST `/rooms`

创建房间。创建者自动成为房主并坐到 0 号位。

请求：

```json
{
  "rules": {
    "preset": "qujing-fei-xiao-ji-v1.5",
    "roundCount": 16,
    "allowChow": true,
    "fanCap": 3,
    "publicKongTiles": 2,
    "xiaoJiTile": "1-tiao",
    "drawMode": "fixed-wall-reserve",
    "allowMultiWin": true
  }
}
```

响应：

```json
{
  "room": {
    "roomId": "886688",
    "ownerId": "u_001",
    "status": "WAITING",
    "rules": {},
    "seats": []
  }
}
```

### POST `/rooms/{roomId}/join`

加入房间。

请求：

```json
{
  "seatIndex": 1
}
```

说明：

- `seatIndex` 可选；不传则后端分配第一个空位。
- 如果房间已满，返回错误。

响应：

```json
{
  "roomId": "886688",
  "ownerId": "u_host",
  "status": "WAITING",
  "rules": {},
  "seats": []
}
```

### POST `/rooms/{roomId}/leave`

退出房间。

请求：

```json
{}
```

响应：

```json
{
  "roomId": "886688",
  "ownerId": "u_next",
  "status": "WAITING",
  "rules": {},
  "seats": []
}
```

规则：

- 如果房主退出，后端按座位顺序把房主顺延给下一个真实玩家。
- 如果只剩 AI，建议解散房间或由第一个 AI 临时占位，具体由后端策略决定。

### POST `/rooms/{roomId}/add-ai`

房主添加 AI。

请求：

```json
{
  "seatIndex": 2,
  "model": "default"
}
```

响应：

```json
{
  "roomId": "886688",
  "ownerId": "u_001",
  "status": "WAITING",
  "rules": {},
  "seats": []
}
```

规则：

- 只有房主可调用。
- AI 默认 `isAI=true`、`isReady=true`。

### POST `/rooms/{roomId}/start`

开始游戏。

请求：

```json
{}
```

响应：

```json
{
  "roomId": "886688",
  "gameId": "game_001"
}
```

规则：

- 只有房主可调用。
- 建议所有真实玩家 ready 后才能开始。
- 后端应同步推送 `ROOM_UPDATE`，房间状态变为 `PLAYING`。

### GET `/rooms/{roomId}`

获取房间详情。

响应：

```json
{
  "roomId": "886688",
  "ownerId": "u_001",
  "status": "WAITING",
  "rules": {},
  "seats": []
}
```

## 5. Game

### PlayerGameView

这是“当前用户视角”的牌局视图。后端不能把其他玩家手牌明牌返回给当前用户。

```json
{
  "roomId": "886688",
  "gameId": "game_001",
  "playerIndex": 0,
  "status": "PLAYING",
  "stepIndex": 18,
  "dealer": 0,
  "currentPlayer": 0,
  "scores": [0, 0, 0, 0],
  "wallTilesRemaining": 72,
  "publicKongTiles": [13, 31],
  "xiaoJiActiveAsWild": true,
  "restrictions": [],
  "self": {
    "hand": [0, 1, 2, 4, 4, 7, 9, 12, 18, 18, 24, 27, 31, 31],
    "melds": [],
    "discards": [3, 8, 28]
  },
  "opponents": [
    {
      "seatIndex": 1,
      "handCount": 13,
      "melds": [],
      "discards": [1, 11, 32],
      "status": "WAITING",
      "isAI": true,
      "nickname": "AI 东山",
      "avatarUrl": ""
    }
  ],
  "lastDiscard": {
    "tile": 21,
    "fromPlayer": 3
  },
  "legalActions": [
    {
      "type": "DISCARD",
      "tile": 0,
      "actionId": 101
    },
    {
      "type": "WIN",
      "tile": 31,
      "actionId": 301
    },
    {
      "type": "PASS",
      "actionId": 1
    }
  ],
  "result": null
}
```

`status`：

```text
INIT | PLAYING | WAITING_RESPONSE | FINISHED | DRAW
```

`ActionType`：

```text
DISCARD
PASS
WIN
PONG
CHOW_LEFT
CHOW_MIDDLE
CHOW_RIGHT
KONG_EXPOSED
KONG_CONCEALED
KONG_ADDED
SELECT_KONG_TILE
```

### Meld

```json
{
  "type": "PONG",
  "tiles": [4, 4, 4],
  "fromPlayer": 3,
  "stepIndex": 12,
  "containsXiaoJiAsWild": false
}
```

### ScoreResult

单局结算。

```json
{
  "winnerIndexes": [0],
  "loserIndexes": [1, 2, 3],
  "dealer": 0,
  "isSelfDraw": true,
  "isDraw": false,
  "baseScore": 1,
  "cappedFan": 3,
  "fanItems": [
    {
      "code": "MEN_QING_ZI_MO",
      "name": "门清自摸",
      "fan": 1,
      "points": 2,
      "description": "门清自摸加分"
    }
  ],
  "scoreDelta": [24, -8, -8, -8],
  "title": "自摸胡牌",
  "description": "本局结算说明"
}
```

后端建议在 `PlayerGameView` 中额外补充以下字段，方便前端最终结算：

```json
{
  "currentRound": 1,
  "maxRounds": 16,
  "totalScores": [24, -8, -8, -8],
  "isFinalRound": false
}
```

当前前端暂用本地计数，后续应改为读取这些字段。

### GET `/games/{gameId}/view`

获取当前用户视角牌局。

响应：

```json
{
  "roomId": "886688",
  "gameId": "game_001",
  "playerIndex": 0,
  "status": "PLAYING",
  "self": {},
  "opponents": [],
  "legalActions": []
}
```

### POST `/games/{gameId}/actions`

提交动作。当前前端主要通过 WebSocket 发送动作，但 REST 可作为兜底或调试接口。

请求：

```json
{
  "type": "DISCARD",
  "tile": 18,
  "actionId": 103,
  "clientSeq": 18,
  "extra": {}
}
```

响应：

```json
{
  "accepted": true,
  "view": {
    "gameId": "game_001",
    "status": "PLAYING"
  }
}
```

校验建议：

- `actionId` 必须来自当前 `legalActions`。
- `clientSeq` 必须等于当前服务端 `stepIndex`，否则返回状态过期错误。

## 6. Replay

### ReplayListItem

```json
{
  "gameId": "game_001",
  "roomId": "886688",
  "title": "曲靖飞小鸡 886688 第1局"
}
```

### ReplayRecord

```json
{
  "roomId": "886688",
  "gameId": "game_001",
  "title": "曲靖飞小鸡 886688 第1局",
  "steps": [
    {
      "stepIndex": 18,
      "view": {},
      "events": []
    }
  ]
}
```

### GET `/replays`

获取回放列表。

响应：

```json
[
  {
    "gameId": "game_001",
    "roomId": "886688",
    "title": "曲靖飞小鸡 886688 第1局"
  }
]
```

### GET `/replays/{gameId}`

获取单局回放。

响应：

```json
{
  "roomId": "886688",
  "gameId": "game_001",
  "title": "曲靖飞小鸡 886688 第1局",
  "steps": []
}
```

## 7. WebSocket

### 客户端发送：订阅房间

```json
{
  "type": "ROOM_SUBSCRIBE",
  "roomId": "886688",
  "ts": 1710000000000
}
```

### 服务端推送：房间更新

```json
{
  "type": "ROOM_UPDATE",
  "roomId": "886688",
  "payload": {
    "room": {}
  },
  "ts": 1710000000000
}
```

### 客户端发送：提交游戏动作

```json
{
  "type": "GAME_ACTION",
  "roomId": "886688",
  "gameId": "game_001",
  "payload": {
    "type": "DISCARD",
    "tile": 18,
    "actionId": 103,
    "clientSeq": 18
  },
  "ts": 1710000000000
}
```

### 服务端推送：游戏事件

```json
{
  "type": "GAME_EVENTS",
  "roomId": "886688",
  "gameId": "game_001",
  "payload": {
    "events": [
      {
        "id": "evt_001",
        "type": "DISCARD",
        "playerIndex": 0,
        "tile": 18,
        "message": "0号玩家打出一万",
        "stepIndex": 19,
        "ts": 1710000000000
      }
    ]
  }
}
```

### 服务端推送：游戏视图

```json
{
  "type": "GAME_VIEW",
  "roomId": "886688",
  "gameId": "game_001",
  "payload": {
    "view": {}
  },
  "ts": 1710000000000
}
```

说明：

- 后端应按用户分别推送各自的 `PlayerGameView`，不能广播同一份包含手牌的视图给所有人。
- 每次动作结算后，建议先推 `GAME_EVENTS`，再推最新 `GAME_VIEW`。

### 心跳

客户端：

```json
{
  "type": "PING",
  "ts": 1710000000000
}
```

服务端：

```json
{
  "type": "PONG",
  "ts": 1710000000000
}
```

### 错误推送

```json
{
  "type": "ERROR",
  "requestId": "optional_request_id",
  "payload": {
    "code": "ACTION_EXPIRED",
    "message": "clientSeq is outdated"
  },
  "ts": 1710000000000
}
```

## 8. 关键业务要求

### 房主逻辑

- 创建房间者为房主。
- 加入房间者不是房主，除非后端分配。
- 只有房主能：
  - 添加 AI；
  - 踢人或移除 AI；
  - 转让房主；
  - 开始游戏。
- 房主退出后，后端按座位顺序顺延房主。

当前前端已有本地 mock 逻辑，但正式环境应由后端作为权威状态源。

### 操作按钮显示

前端不自行判断能否吃碰杠胡，只根据 `legalActions` 显示按钮：

- 有 `WIN` 才显示胡。
- 有 `PONG` 才显示碰。
- 有 `CHOW_*` 才显示对应吃。
- 有 `KONG_*` 才显示杠。
- 有 `PASS` 才显示过。

### 轮次与最终结算

后端应维护：

- 当前第几局；
- 最大局数；
- 每局分数变化；
- 总分；
- 是否最终局。

建议在 `PlayerGameView` 补充：

```json
{
  "currentRound": 3,
  "maxRounds": 16,
  "totalScores": [48, -16, -16, -16],
  "isFinalRound": false
}
```

当 `isFinalRound=false` 且 `status=FINISHED` 时，前端显示“继续游戏”。

当 `isFinalRound=true` 且 `status=FINISHED` 时，前端显示总分结算并允许结束回房间。

### 安全要求

- 所有动作必须由后端校验。
- 客户端提交的 `tile/actionId/clientSeq` 不能直接信任。
- 后端应只返回当前玩家可见信息。
- 回放数据可以包含完整视图，但如果用于公开分享，需要脱敏或转成观战视图。
