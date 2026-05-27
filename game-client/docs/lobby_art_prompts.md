# 大厅页美术资源需求与 AI 绘图 Prompt

目标页面：`Lobby.scene` / `LobbyController`

设计方向：微信小游戏入口页，适配手机竖屏和 Web Mobile 预览。画面内容集中在中间安全区，避免超宽横排文字。风格建议为“云南地方麻将 + 现代休闲棋牌 UI”，清晰、干净、按钮明显。

## 推荐画布

| 用途 | 尺寸 | 格式 | 说明 |
| --- | --- | --- | --- |
| 大厅背景 | `750x1334` | PNG/JPG | 竖屏整图，安全内容放中间 |
| 标题 Logo | `520x160` | PNG 透明背景 | “曲靖飞小鸡”四字，后续可替换 Label |
| 主按钮 | `420x120` | PNG 透明背景 | 创建房间按钮底图 |
| 信息面板 | `640x360` | PNG 透明背景 | 可九宫格切图，承载规则文字 |
| 装饰麻将牌 | `256x256` | PNG 透明背景 | 小鸡/一条主题装饰 |

## 资源列表

| 文件建议名 | 当前占位 | 用途 | 优先级 |
| --- | --- | --- | --- |
| `lobby_bg.png` | 纯色背景面板 | 大厅整屏背景 | 高 |
| `lobby_logo.png` | 标题 Label | 曲靖飞小鸡标题 | 高 |
| `panel_main.png` | 纯色面板 | 中央信息区域 | 中 |
| `button_primary.png` | 纯色按钮 | 创建房间按钮 | 高 |
| `icon_xiaoji.png` | 无 | 小鸡/一条主题图标 | 中 |
| `tile_decor_group.png` | 无 | 麻将牌装饰组合 | 低 |

## Prompt 1：大厅背景

```text
Create a mobile portrait game lobby background for a Chinese mahjong mini game, 750x1334, inspired by Yunnan Qujing local mahjong culture, elegant dark emerald green table felt, subtle radial lighting in the center, faint mahjong tile silhouettes around the edges, premium casual board game atmosphere, clean UI-safe center area, no text, no logo, no people, no clutter, high contrast, polished mobile game art, PNG style
```

负面词：

```text
text, letters, watermark, logo, people, hands, photorealistic casino, cluttered background, low resolution, blurry, strong purple gradient, excessive gold
```

## Prompt 2：标题 Logo

```text
Design a transparent PNG title logo for a Chinese mahjong mini game named "曲靖飞小鸡", bold readable Chinese calligraphy-inspired display lettering, modern casual game logo, emerald green and warm ivory colors with subtle gold trim, small mahjong tile and 1-bamboo xiaoji motif integrated tastefully, clean silhouette, transparent background, centered composition
```

负面词：

```text
extra text, English words, watermark, unreadable Chinese characters, messy strokes, photorealistic, dark background
```

## Prompt 3：主按钮图

```text
Create a transparent PNG primary button asset for a mobile mahjong game. The button text MUST be baked directly into the image, centered and fully readable. Baked text reads "开始游戏", size ratio 420x120, emerald green base with soft inner highlight, warm gold edge, subtle pressed depth, polished casual mobile game UI
```

负面词：

```text
empty button, no text, placeholder text, cropped Chinese characters, off-center text, text outside button, unreadable text, watermark, icon, overly glossy, neon, purple, noisy texture
```

## Prompt 4：信息面板

```text
Create a transparent PNG information panel for a mobile Chinese mahjong game lobby, 640x360, dark jade green panel, thin warm gold border, subtle felt texture, soft shadow, clean flat center area for text, slightly rounded corners, polished casual board game UI, no text, no icons
```

负面词：

```text
text, watermark, heavy ornament, clutter, photorealistic wood, excessive glow
```

## Prompt 5：小鸡/一条图标

```text
Create a transparent PNG mascot icon for a Qujing mahjong game, cute stylized "1 bamboo" mahjong tile with a small chicken motif, friendly but not childish, clean vector-like mobile game style, emerald green, ivory, and warm gold palette, centered, no text, transparent background
```

负面词：

```text
text, watermark, realistic animal, scary, overly cartoonish, cluttered background
```

## 接入建议

1. 先生成 `lobby_bg.png` 和 `button_primary.png`，这两个对观感提升最大。
2. 背景图放 `assets/textures/ui/lobby_bg.png`。
3. 按钮图放 `assets/textures/ui/button_primary.png`。
4. 标题图放 `assets/textures/ui/lobby_logo.png`。
5. 生成图片后再把 `RuntimeUi` 里的纯色 `Sprite` 替换为加载 SpriteFrame。
