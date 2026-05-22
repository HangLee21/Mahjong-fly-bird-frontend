# Cocos 微信小游戏客户端架构

`game-client/` 是新的主前端。旧 `frontend/` 是普通微信小程序页面实现，仅作为过渡参考。

## 分层

| 层级 | 目录 | 职责 |
| --- | --- | --- |
| App | `assets/scripts/app` | 全局配置、事件名、常量 |
| Core | `assets/scripts/core` | EventBus、FSM、对象池、基础场景/视图 |
| Network | `assets/scripts/network` | HTTP、WebSocket、协议、重连 |
| Manager | `auth/ room/ game/ replay` | 跨场景业务状态 |
| Controller | `*Controller.ts` | 场景逻辑、事件绑定、驱动 View |
| View | `game/views` | Cocos 节点展示、动画、输入事件 |
| Assets | `textures audio prefabs` | 牌面、桌面、UI、音效 |

## 原则

- 后端是唯一裁判。
- 客户端只展示 `PlayerGameView`。
- 客户端只提交动作意图。
- 吃碰杠胡按钮只来自 `legalActions`。
- 牌桌、动画、音效全部走 Cocos 游戏客户端能力。
