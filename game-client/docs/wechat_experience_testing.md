# 微信小游戏体验版测试

本项目使用以下测试身份：

```text
AppID: wx67f006b9a7827b2a
```

体验版不需要提交审核，但仍需要真实 AppID、手机可访问的 HTTPS/WSS
后端，以及满足小游戏主包体积要求的远程资源。

## 1. 准备 HTTPS 测试域名

推荐让同一个域名同时提供接口、WebSocket 和远程资源：

```text
https://flybirdmahjong.fun/api
wss://flybirdmahjong.fun/ws
https://flybirdmahjong.fun/game-assets/
```

后端仓库已经通过 Caddy 配置上述入口。将域名 DNS 指向服务器后，参考后端
`SERVER_DEPLOYMENT.md` 启动服务。

后端 `.env.server` 至少配置：

```env
SERVER_DOMAIN=flybirdmahjong.fun
WECHAT_APP_ID=wx67f006b9a7827b2a
WECHAT_MOCK_LOGIN=false
```

微信服务器凭据只保存在后端未纳入版本控制的环境文件中，不得写入前端或提交到 Git。

## 2. 配置微信合法域名

在微信公众平台的开发设置中，把同一个 HTTPS 域名加入：

- request 合法域名；
- socket 合法域名；
- downloadFile 合法域名。

开发者工具可以临时关闭域名校验，但体验成员的真机测试应使用合法
HTTPS/WSS 域名。

## 3. 构建体验版

先在 Cocos Creator 中关闭该项目，然后在前端仓库根目录运行：

```powershell
.\scripts\build-wechat-experience.ps1 `
  -ServerOrigin https://flybirdmahjong.fun
```

脚本会拒绝
`example.com` 和 `localhost`，避免误上传一个真机必然无法启动的体验包。

脚本会完成以下操作：

1. 写入体验版 API 域名；
2. 使用 AppID `wx67f006b9a7827b2a`；
3. 启用 MD5 资源版本；
4. 将 `resources` 构建为远程 Asset Bundle；
5. 只保留牌桌实际使用的 2D、UI、音频、Tween 和 WebGL 引擎模块；
6. 关闭项目未使用的物理、Spine、DragonBones、粒子和 3D 模块；
7. 在微信开发者工具上传规则中排除本地 `remote` 目录；
8. 校验 AppID、资源服务器、远程 Bundle 和本地主包体积。

隔离构建验证结果为：本地主包约 `1.74 MiB`，远程资源约 `52.79 MiB`。
实际大小会随后续代码和资源变化，脚本会在每次构建后重新检查 `4 MiB` 上限。

构建输出：

```text
game-client/build/wechatgame
game-client/build/wechatgame/remote
```

`remote` 保留在构建目录中是为了便于同步到服务器，但生成的
`project.config.json` 已通过 `packOptions.ignore` 将它排除在预览和上传包外。

## 4. 将资源同步到后端

在前端仓库根目录运行：

```powershell
.\scripts\sync-wechat-remote-assets.ps1
```

它会把整个 `remote` 目录合并复制到：

```text
E:\Mahjong-fly-bird-backend\game-assets\remote
```

在服务器上部署时，也必须把这个目录上传到后端仓库相同位置，然后重新加载
Caddy。不要只上传 `remote/resources/native`。

先找到本次构建生成的远程配置文件：

```powershell
Get-ChildItem .\game-client\build\wechatgame\remote\resources\config*.json
```

将输出文件名拼到服务器地址后验证，例如：

```text
https://flybirdmahjong.fun/game-assets/remote/resources/config.df718.json
```

启用 MD5 后文件名会带 Hash；不要把示例中的 `df718` 当作固定值。

## 5. 上传体验版

1. 使用微信开发者工具导入 `game-client/build/wechatgame`；
2. 使用小游戏管理员或开发成员微信登录；
3. 真机预览，确认登录、建房、WebSocket 和资源加载正常；
4. 点击“上传”，填写测试版本号；
5. 微信公众平台 -> 版本管理 -> 开发版本 -> 设为体验版；
6. 在成员管理中添加体验成员并分享体验二维码。

## 登录行为

- 微信小游戏环境调用 `wx.login()`，登录凭证发送到真实后端；
- 正式体验配置关闭浏览器模拟登录，登录联调应使用微信开发者工具或真机；
- 启动时会校验实际 AppID，避免误用其他小游戏账号构建；
- 域名仍为 `example.com` 时会直接提示配置错误，而不是静默卡在登录页。

首次启动会先下载远程 `resources` Bundle 的配置文件，再按需下载场景使用的
图片和音频。资源请求失败时，优先检查 `downloadFile` 合法域名、远程目录是否
完整上传，以及服务器返回的证书链是否有效。
