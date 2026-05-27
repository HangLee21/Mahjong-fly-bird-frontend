# Game Scene Mock Scenarios

这些流程用于检查 Game Scene 的主要交互是否正常。当前客户端仍以 mock 数据为主，真正规则判定应以后端返回的 `PlayerGameView.legalActions` 为准。

## 1. 出牌流程

初始状态：

- `self.hand` 包含 14 张手牌。
- `legalActions` 包含若干 `DISCARD` 动作。

操作：

1. 点击一张可出的手牌。
2. 该牌上抬，其他同牌值不会一起上抬。
3. 再次点击同一张牌。
4. 客户端发送 `GAME_ACTION`，类型为 `DISCARD`。

期望：

- 第一次点击不闪屏。
- 第二次点击后等待服务端或 mock ws 推送新 `GAME_VIEW`。

## 2. 碰牌流程

构造局面：

- 上家打出 `5筒`。
- 自己手牌中有两张 `5筒`。
- `legalActions` 包含：

```json
[
  { "type": "PONG", "tile": 5, "actionId": 201 },
  { "type": "PASS", "actionId": 1 }
]
```

操作：

1. 操作区出现“碰”和“过”按钮。
2. 点击“碰”。

期望：

- 客户端发送 `PONG` 动作。
- 新视图中 `self.melds` 增加一组碰牌。
- 当前玩家切到自己，并允许继续出牌。

## 3. 吃牌流程

构造局面：

- 上家打出可组成顺子的牌。
- 自己手牌满足左吃、中吃或右吃。
- `legalActions` 包含 `CHOW_LEFT` / `CHOW_MIDDLE` / `CHOW_RIGHT` 中至少一种，以及 `PASS`。

操作：

1. 操作区只显示后端允许的吃牌按钮。
2. 点击其中一个吃牌按钮。

期望：

- 客户端发送对应 `CHOW_*` 动作。
- 新视图中 `self.melds` 增加吃牌组合。
- 吃牌后需要自己出一张牌。

## 4. 杠牌流程

构造局面：

- 明杠：别人打出一张，自己手里有三张相同牌。
- 暗杠：自己手里有四张相同牌。
- 补杠：已有碰牌，摸到第四张。
- `legalActions` 包含 `KONG_EXPOSED` / `KONG_CONCEALED` / `KONG_ADDED`。

操作：

1. 点击“杠”按钮。

期望：

- 客户端发送对应杠牌动作。
- 新视图中 `publicKongTiles` 或 `melds` 更新。
- 若规则需要选公开杠牌，后端返回 `SELECT_KONG_TILE` 动作。

## 5. 胡牌流程

构造局面：

- 自摸或点炮后，后端判断自己可胡。
- `legalActions` 包含：

```json
[
  { "type": "WIN", "tile": 31, "actionId": 301 },
  { "type": "PASS", "actionId": 1 }
]
```

操作：

1. 操作区出现“胡”和“过”按钮。
2. 点击“胡”。

期望：

- 客户端发送 `WIN` 动作。
- 新视图状态变为 `FINISHED`。
- 弹出结算面板，显示四家分数变化和番型。

## 6. 一炮多响流程

构造局面：

- 某玩家打出一张牌。
- 多名玩家均可胡。
- 每个可胡玩家收到自己的 `WIN` / `PASS` 动作。

操作：

1. 当前玩家选择胡或过。
2. 等待其他玩家响应。

期望：

- 所有响应完成后进入结算。
- `result.winnerIndexes` 包含多个赢家。
- `scoreDelta` 正确展示多家得分变化。

## 7. 小鸡万能检查

构造局面：

- `xiaoJiActiveAsWild` 为 `true`。
- `publicKongTiles` 包含公开杠牌。
- 手牌中有小鸡牌。

操作：

1. 观察中心区显示小鸡万能状态。
2. 构造一组只有小鸡作癞子才能胡的手牌。
3. 后端返回 `WIN` 动作。

期望：

- 操作区出现“胡”。
- 结算番型中体现小鸡相关规则。
