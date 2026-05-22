# Mahjong-fly-bird-frontend

曲靖飞小鸡客户端仓库。

## 当前主路线

新的前端主路线是：

```text
game-client/
  Cocos Creator 3.x + TypeScript + 微信小游戏
```

普通微信小程序页面版保留在：

```text
frontend/
  Legacy 小程序页面实现
```

麻将牌桌、动画、音效、拖拽、出牌等游戏体验后续以 `game-client/` 为准。

## game-client 验证

```bash
cd game-client
npm install
npm run typecheck
npm test
```

用 Cocos Creator 3.x 打开 `game-client/`，构建目标选择“微信小游戏”。
