# 场景流

```text
Boot
  -> Login
  -> Lobby
  -> RoomEntry
  -> Room
  -> Game
  -> Game Result Dialog
  -> Room
  -> Result
  -> Replay
```

第一阶段实现重点：

1. `Boot` 初始化配置、资源、网络。
2. `Login` 支持 mock login 和微信 code 登录。
3. `Room` 支持创建房间、加 AI、开始游戏。
4. `Game` 通过 `GameController + GameBoardView` 渲染牌桌。
5. `Result/Replay` 复用协议和牌桌视图。

## 当前已补齐的场景资产

场景文件位于 `assets/scenes/`：

| 场景 | 根节点建议挂载组件 | 入口职责 |
| --- | --- | --- |
| `Boot.scene` | `BootController` | 根据 mock/token 进入 `Lobby` 或 `Login` |
| `Login.scene` | `LoginController` | mock 登录或微信 code 登录 |
| `Lobby.scene` | `LobbyController` | 创建房间并进入 `Room` |
| `RoomEntry.scene` | `RoomEntryController` | 输入房间号加入房间，或创建房间 |
| `Room.scene` | `RoomSceneController` | 补 AI、开始游戏并进入 `Game` |
| `Game.scene` | `GameController` | 拉取 `PlayerGameView`、绑定 WebSocket、渲染牌桌 |
| `Result.scene` | `ResultController` | 展示 `ScoreResult`，进入回放或大厅 |
| `Replay.scene` | `ReplayController` | 加载牌谱并复用 `GameBoardView` 播放步骤 |

基础预制体占位位于 `assets/prefabs/`：

| 预制体 | 用途 |
| --- | --- |
| `Tile.prefab` | 牌面节点，占位给 `TileView` 使用 |
| `ActionButton.prefab` | 吃、碰、杠、胡、过等动作按钮 |
| `GameBoard.prefab` | 牌桌根节点，包含 `CenterTable`、`Hand`、`ActionPanel` |
| `ResultPanel.prefab` | 结算面板 |

这些资产是最小结构，占位用于把 Creator 工程的场景和资源入口补齐。

## 代码生成 UI 的最小接入方式

当前已加入运行时 UI 构建：

- `LobbyController` 自动生成标题和创建房间按钮。
- `RoomSceneController` 自动生成房间标题、规则、座位、补 AI 并开始、直接开始按钮。
- `GameController` 在 `boardView` 未绑定时自动生成 `GameBoard/CenterTable/Hand/ActionPanel/Seats/Discards/Melds/PublicKongTiles/Status`。
- `ResultController` 自动生成结算面板和回放/大厅按钮。
- `ReplayController` 自动生成牌桌和上一步/下一步按钮。

Mock 牌桌当前支持：

- 点击手牌：第一次选中，第二次提交 `DISCARD`。
- 点击动作按钮：提交 `WIN`、`KONG_CONCEALED`、`PASS` 等后端下发的 `legalActions`。
- 点击杠：Mock WS 推出 `SELECT_KONG_TILE`，要求从两张公开杠牌中取牌。
- 点击胡：进入 `Result.scene` 展示 `ScoreResult`。
- 结算后可进入 `Replay.scene`，通过上一步/下一步播放 Mock 牌谱。

因此在 Cocos Creator 中，最小人工操作只剩：

1. 打开对应 `.scene`。
2. 选中根节点，例如 `BootRoot`、`LobbyRoot`、`GameRoot`。
3. 添加对应 Controller 脚本组件。
4. 保存场景。

如果后续要做正式 UI，再把自动生成的节点改成美术 Prefab，并把属性拖拽绑定到 Controller/View 上即可。代码会优先使用已绑定的节点；没绑定时才走运行时生成。
