# 曲靖飞小鸡 Cocos 微信小游戏客户端

这是新的主前端方向：`Cocos Creator 3.x + TypeScript + 微信小游戏`。

旧的 `frontend/` 是普通微信小程序页面实现，后续仅作为 legacy 参考；新的游戏客户端放在 `game-client/`。

## 目标

- 使用 Cocos 场景、组件、Tween、Audio、Asset Bundle 实现游戏式牌桌。
- 通过 HTTP/WebSocket 对接后端权威 `PlayerGameView`。
- 客户端只展示和提交动作意图，不做规则裁决。
- 第一版支持 Mock 跑通：登录 -> 大厅 -> 房间 -> 牌桌 -> 出牌 -> 结算 -> 回放。

## 开发

```bash
npm install
npm run typecheck
npm test
```

在 Cocos Creator 3.x 中打开 `game-client/`，按 `docs/scene_flow.md` 创建/绑定场景与预制体，然后构建目标选择“微信小游戏”。

当前已提供 `assets/scenes/Boot.scene`、`Login.scene`、`Lobby.scene`、`Room.scene`、`Game.scene`、`Result.scene`、`Replay.scene` 七个场景占位，以及 `assets/prefabs/` 下的基础牌桌预制体占位。Mock HTTP/WS 默认开启，可先跑通本地闭环，再替换真实后端。
