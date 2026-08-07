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

麻将牌桌、动画、音效、选牌出牌、吃碰杠和结算等游戏体验以
`game-client/` 为准。

## game-client 验证

```bash
cd game-client
npm install
npm run typecheck
npm test
```

用 Cocos Creator 3.8.8 打开 `game-client/`，从 `Boot.scene` 运行，
构建目标选择“微信小游戏”。详细状态和资源授权见
[`game-client/README.md`](game-client/README.md)。

微信小游戏体验版使用 AppID `wx67f006b9a7827b2a`，真实登录、HTTPS/WSS
和远程资源构建步骤见
[`game-client/docs/wechat_experience_testing.md`](game-client/docs/wechat_experience_testing.md)。
