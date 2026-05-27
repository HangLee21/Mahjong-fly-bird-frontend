# 房间页美术资源需求与 AI 绘图 Prompt

目标页面：`Room.scene` / `RoomSceneController`

用途：玩家进入房间后查看房号、规则、四个座位、AI 状态，并点击“补 AI 并开始”或“直接开始”进入牌桌。

设计方向：微信小游戏竖屏界面，中央为四人座位区域，底部为主要操作按钮。风格延续大厅页：云南地方麻将、深翡翠绿、温暖金色描边、现代休闲棋牌 UI。

## 放置路径

生成后的图片统一放到：

```text
game-client/assets/textures/ui/
```

代码调用时使用不带扩展名的路径，例如：

```text
textures/ui/room_bg
textures/ui/seat_empty
textures/ui/button_start
```

## 资源列表

| 文件名 | 用途 | 建议尺寸 | 格式 | 优先级 |
| --- | --- | --- | --- | --- |
| `room_bg.png` | 房间页整屏背景 | `750x1334` | PNG/JPG | 高 |
| `seat_empty.png` | 空座位框 | `220x220` | PNG 透明背景 | 高 |
| `seat_player.png` | 玩家座位框 | `220x220` | PNG 透明背景 | 高 |
| `seat_ai.png` | AI 座位框 | `220x220` | PNG 透明背景 | 高 |
| `button_start.png` | 开始游戏按钮 | `420x120` | PNG 透明背景 | 高 |
| `button_add_ai.png` | 补 AI 按钮 | `360x100` | PNG 透明背景 | 高 |
| `room_panel.png` | 房间规则/信息面板 | `640x260` | PNG 透明背景 | 中 |
| `badge_owner.png` | 房主标识 | `120x48` | PNG 透明背景 | 中 |
| `badge_ready.png` | 已准备标识 | `120x48` | PNG 透明背景 | 中 |
| `avatar_placeholder.png` | 默认头像 | `128x128` | PNG 透明背景 | 中 |

## Prompt：room_bg.png

```text
Create a mobile portrait background for a Chinese mahjong room setup screen, 750x1334, dark emerald green mahjong table atmosphere, subtle felt texture, soft warm lighting, faint four-player table layout implied in the center, clean UI-safe areas at top and bottom, modern casual board game style, no text, no logo, no people, no clutter, polished mobile game art
```

## Prompt：seat_empty.png

```text
Create a transparent PNG empty seat frame for a mobile Chinese mahjong game, square 220x220, rounded jade green frame, subtle gold trim, empty center for avatar, soft shadow, polished casual board game UI, no text, no icon, transparent background
```

## Prompt：seat_player.png

```text
Create a transparent PNG player occupied seat frame for a mobile Chinese mahjong game, square 220x220, jade green and warm gold border, avatar circle area in center, small decorative mahjong tile corners, premium casual board game UI, no text, transparent background
```

## Prompt：seat_ai.png

```text
Create a transparent PNG AI occupied seat frame for a mobile Chinese mahjong game, square 220x220, jade green frame with subtle blue technology accent, avatar circle area in center, small robot-like badge area but no text, polished casual board game UI, transparent background
```

## Prompt：button_start.png

```text
Create a transparent PNG primary start game button for a mobile Chinese mahjong game, 420x120, emerald green base, warm gold border, subtle pressed depth, bright but elegant highlight, clean center area for Chinese text overlay, no text, no icon, polished mobile game UI
```

## Prompt：button_add_ai.png

```text
Create a transparent PNG secondary button for adding AI players in a mobile Chinese mahjong game, 360x100, dark jade green base, soft cyan accent, thin gold trim, clean center area for Chinese text overlay, no text, no icon, polished casual mobile game UI
```

## Prompt：room_panel.png

```text
Create a transparent PNG information panel for a mobile Chinese mahjong room screen, 640x260, dark jade green panel, thin warm gold border, subtle felt texture, soft inner shadow, clean center area for room ID and rule text, no text, no icons, polished mobile board game UI
```

## Prompt：badge_owner.png

```text
Create a transparent PNG small badge for room owner status in a mobile mahjong game, 120x48, warm gold badge, jade shadow, clean center area for text overlay, no text, polished casual game UI
```

## Prompt：badge_ready.png

```text
Create a transparent PNG small ready status badge for a mobile mahjong game, 120x48, emerald green badge with light gold edge, clean center area for text overlay, no text, polished casual game UI
```

## Prompt：avatar_placeholder.png

```text
Create a transparent PNG default avatar placeholder for a Chinese mahjong mobile game, 128x128, circular jade green avatar, subtle mahjong tile motif, friendly neutral style, no face, no text, clean mobile game UI
```

## 通用负面词

```text
text, letters, watermark, logo, real people, clutter, blurry, low resolution, photorealistic casino, excessive neon, purple gradient, unreadable symbols
```

## 接入顺序

1. 优先生成 `room_bg.png`、`seat_player.png`、`seat_ai.png`、`button_start.png`、`button_add_ai.png`。
2. 放入 `game-client/assets/textures/ui/`。
3. 等 Cocos Creator 自动导入资源并生成 `.meta`。
4. 同步到 `game-client/assets/resources/textures/ui/`，或让我帮你同步并接入 `RoomSceneController`。
5. 将当前纯色房间页替换为图片版房间页。
