# 场景流

```text
Boot
  -> Login
  -> Lobby
  -> Room
  -> Game
  -> Result
  -> Replay
```

第一阶段实现重点：

1. `Boot` 初始化配置、资源、网络。
2. `Login` 支持 mock login 和微信 code 登录。
3. `Room` 支持创建房间、加 AI、开始游戏。
4. `Game` 通过 `GameController + GameBoardView` 渲染牌桌。
5. `Result/Replay` 复用协议和牌桌视图。
