# 资源落表

当前版本优先把流程和交互跑通，除麻将牌面外，其余资源先用运行时 Label/Button/Node 占位。

## 麻将牌资源

| 资源 | 当前路径 | 目标来源 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 万/筒/条/字牌牌面 | `assets/textures/tiles/tile_0.png` 到 `tile_33.png`，同步到 `assets/resources/textures/tiles/` | `black-desk/mahjim` | 已接入 | 代码按 `TileId 0-33` 映射 |
| 牌背 | `assets/textures/tiles/tile_back.png`，同步到 `assets/resources/textures/tiles/` | `black-desk/mahjim` | 已接入 | 对手暗牌、牌墙可复用 |

已通过临时克隆 `https://github.com/black-desk/mahjim` 获取 `assets/files/` 下基础牌图，并复制为当前项目牌图。该仓库没有看到明确 LICENSE 文件，README 仅写有“感谢图片来源 Neerdge qq820812450”，因此这些牌图在正式商用或上线前需要再次确认授权。

## TileId 映射

| TileId | 牌 | mahjim 来源 |
| --- | --- | --- |
| 0-8 | 1-9 万 | `1mcn.png` 到 `9mcn.png` |
| 9-17 | 1-9 筒 | `1p.png` 到 `9p.png` |
| 18-26 | 1-9 条 | `1scn.png`, `2s.png` 到 `9s.png` |
| 27-33 | 东南西北中发白 | `东cn.png`, `南cn.png`, `西cn.png`, `北cn.png`, `中cn.png`, `发cn.png`, `白cn.png` |
| back | 牌背 | `blue.png` |

## 占位资源清单

| 模块 | 需要的正式资源 | 当前占位 |
| --- | --- | --- |
| 大厅 | 背景图、标题图、主按钮图 | 运行时 Label/Button |
| 房间 | 座位框、头像框、准备/AI 标识 | 运行时 Label |
| 牌桌 | 桌面背景、方向风、玩家头像、庄家标识 | 运行时 Label/Node |
| 手牌 | 牌面 Sprite、选中/禁用状态图 | Label 显示牌名 |
| 弃牌 | 小尺寸牌面 Sprite | Label 显示牌名 |
| 副露 | 吃碰杠组合牌面 | Label 显示牌名 |
| 公开杠牌 | 杠牌区底板、牌面 Sprite | Label 显示牌名 |
| 动作按钮 | 吃/碰/杠/胡/过/取牌按钮图 | 运行时 Button + Label |
| 结算 | 结算面板、番型行、分数变化特效 | 运行时 ResultPanel + Label |
| 回放 | 播放/暂停/上一步/下一步按钮图 | 运行时 Button + Label |
| 音效 | 出牌、摸牌、吃碰杠胡、结算音效 | 暂无，后续接 AudioSource |
| 动画 | 出牌飞行动画、碰杠胡特效、结算弹窗动画 | 部分 Tween 接口占位 |

## 替换规则

1. 正式资源尽量保持当前文件名，减少代码改动。
2. 麻将牌资源替换后优先验证 `TileId -> 文件名` 映射。
3. 非牌面资源建议先做 Prefab，再逐步替换运行时 UI。
4. 资源授权未确认前，不要把第三方图片直接提交到生产分支。
