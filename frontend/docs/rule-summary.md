# 曲靖飞小鸡规则摘要

来源：仓库根目录 `曲靖飞小鸡规则.pdf`，Ver. 1.5。

前端实现原则：

| 规则点 | 前端处理 |
| --- | --- |
| 136 张牌，含万/筒/条/东南西北中发白 | `tile-utils.ts` 提供 0-33 的显示映射 |
| 小鸡为 1 条 | `XIAO_JI_TILE_ID = 18`，UI 标记“小鸡” |
| 小鸡可作万能参与暗杠、加杠、和牌 | 作为 `xiaoJiActiveAsWild` 与 `legalActions` 展示，不在前端判断 |
| 小鸡不能作为万能参与吃/碰 | 后端不应下发非法吃/碰动作 |
| 开局公开两张杠牌 | `PlayerGameView.publicKongTiles` 渲染 |
| 杠后从公开杠牌取一张并补翻 | 预留 `SELECT_KONG_TILE` 动作 |
| 和牌优先于杠碰吃 | 后端按优先级裁决，前端只展示后端推送 |
| 同巡振听、小鸡拒和振听、拒碰限制 | `restrictions` 展示提示，后端裁决 |
| 流局阈值、四风连打 | 后端裁决，结果通过 `status=DRAW/FINISHED` 和 `result` 下发 |
| 番种表与三番封顶 | `ScoreResult.fanItems` 与 `cappedFan` 展示 |
