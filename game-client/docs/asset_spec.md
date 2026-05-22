# 资源规范

牌图路径：

```text
assets/textures/tiles/tile_0.png
...
assets/textures/tiles/tile_33.png
assets/textures/tiles/tile_back.png
```

映射函数：

```ts
getTileTexturePath(tileId)
```

后续建议：

- 牌图合并图集。
- 音效资源拆到远程 bundle。
- 桌面、按钮、特效做独立 bundle。
