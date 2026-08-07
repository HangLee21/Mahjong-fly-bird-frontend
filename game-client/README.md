# 曲靖飞小鸡 Cocos 微信小游戏客户端

当前主前端采用 `Cocos Creator 3.8.8 + TypeScript + 微信小游戏`。旧的
`frontend/` 是普通微信小程序页面实现，仅作为 legacy 参考。

## 运行状态

- Cocos/Web 预览默认连接 `localhost:3000` 的真实后端。
- 微信小游戏体验版使用 AppID `wx67f006b9a7827b2a`，通过
  `ExperienceEnvironment.ts` 配置 HTTPS/WSS 服务域名。
- 体验版仅在微信环境调用 `wx.login()`；浏览器模拟登录已关闭，避免向正式后端发送测试凭证。
- 后端提供权威 `PlayerGameView`、合法动作和胡牌/计分结果。
- 客户端负责场景、牌桌、交互、动画、音效和动作意图提交，不在本地裁决规则。
- 已包含 Boot、Login、Lobby、RoomEntry、Room、Game、Result、Replay 八个场景。
- 牌桌支持单击选牌、再次单击出牌、吃碰杠牌型预览、响应牌提示和结算展示。
- AI 出牌增加短暂停顿，牌局状态更新采用增量节点复用，减少全屏闪烁。
- 背景音乐与操作音效支持跨场景播放、淡入淡出和微信前后台恢复。

## 本地验证

```bash
cd game-client
npm install
npm run typecheck
npm test
```

启动后端服务后，用 Cocos Creator 3.8.8 打开本目录，从 `Boot.scene`
运行。发布时在构建面板选择“微信小游戏”，重新构建后再在微信开发者工具中编译。

本地地址及 Mock 开关位于
[`assets/scripts/app/AppConfig.ts`](assets/scripts/app/AppConfig.ts)，体验版域名位于
[`assets/scripts/app/ExperienceEnvironment.ts`](assets/scripts/app/ExperienceEnvironment.ts)。

## 资源与文档

- 音频授权记录：[`assets/resources/audio/LICENSES.md`](assets/resources/audio/LICENSES.md)
- 场景流程：[`docs/scene_flow.md`](docs/scene_flow.md)
- 后端接口契约：[`docs/backend_api_contract.md`](docs/backend_api_contract.md)
- WebSocket 协议：[`docs/websocket_protocol.md`](docs/websocket_protocol.md)
- UI 美术提示词：[`docs/ui_asset_generation_prompts.md`](docs/ui_asset_generation_prompts.md)
- 微信体验版测试：[`docs/wechat_experience_testing.md`](docs/wechat_experience_testing.md)

`assets/resources` 已配置为微信平台远程 Asset Bundle。微信构建后将
`build/wechatgame/remote` 整体同步到后端 `game-assets/remote`，Caddy 会通过
`/game-assets/` 提供图片和音频资源。
