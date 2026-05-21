# 曲靖飞小鸡微信小程序前端

原生微信小程序 + TypeScript + WXML/WXSS。第一版默认开启 Mock：

```ts
// config/env.ts
USE_MOCK_API: true
USE_MOCK_WS: true
```

## 使用

1. 在有 Node/npm 的环境执行 `npm install`
2. 执行 `npm run build:ts` 生成小程序可直接加载的 `.js` 文件
3. 用微信开发者工具打开 `frontend/`
4. 运行小程序：登录 -> 创建房间 -> 开始游戏 -> 进入牌桌 -> 点击手牌出牌 -> 查看结算和回放

## 规则边界

前端严格不实现规则裁决。曲靖飞小鸡中的小鸡万能、公开杠牌、吃碰杠胡优先级、振听/拒碰、流局、四风连打、番种和计分都由后端返回的 `PlayerGameView` 与 `ScoreResult` 决定。

后端接口预留见 [docs/backend-api-table.md](docs/backend-api-table.md)。
