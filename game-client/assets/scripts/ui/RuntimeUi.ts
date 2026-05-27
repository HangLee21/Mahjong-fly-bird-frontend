import {
  assetManager,
  Button,
  Camera,
  Canvas,
  Color,
  Component,
  Label,
  Layers,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec3,
  view,
} from 'cc';

type ComponentCtor<T> = new (...args: never[]) => T;

export function ensureChild(parent: Node, name: string): Node {
  const existing = parent.children.find((child) => child.name === name);
  if (existing) return existing;
  const node = new Node(name);
  node.layer = parent.layer;
  parent.addChild(node);
  return node;
}

interface RuntimeSize {
  width: number;
  height: number;
}

export function ensureCanvas(parent: Node, sizeOverride?: RuntimeSize): Node {
  const canvas = ensureChild(parent, 'RuntimeCanvas');
  canvas.layer = Layers.Enum.UI_2D;
  canvas.setPosition(Vec3.ZERO);
  const size = sizeOverride || getViewportSize();
  const cameraNode = ensureChild(canvas, 'RuntimeCamera');
  cameraNode.layer = Layers.Enum.UI_2D;
  cameraNode.setPosition(0, 0, 1000);
  const camera = ensureComponent(cameraNode, Camera);
  camera.projection = Camera.ProjectionType.ORTHO;
  camera.visibility = Layers.Enum.UI_2D;
  camera.orthoHeight = size.height / 2;
  const canvasComp = ensureComponent(canvas, Canvas);
  canvasComp.cameraComponent = camera;
  ensureComponent(canvas, UITransform).setContentSize(size.width, size.height);
  return canvas;
}

export interface RuntimeLayout {
  width: number;
  height: number;
  minSide: number;
  w(percent: number): number;
  h(percent: number): number;
  s(percent: number): number;
  pos(xPercent: number, yPercent: number): Vec3;
}

export function createLayout(sizeOverride?: RuntimeSize): RuntimeLayout {
  const size = sizeOverride || getViewportSize();
  const minSide = Math.min(size.width, size.height);
  return {
    width: size.width,
    height: size.height,
    minSide,
    w: (percent: number) => (size.width * percent) / 100,
    h: (percent: number) => (size.height * percent) / 100,
    s: (percent: number) => (minSide * percent) / 100,
    pos: (xPercent: number, yPercent: number) => new Vec3((size.width * xPercent) / 100, (size.height * yPercent) / 100, 0),
  };
}

export function ensureComponent<T>(node: Node, ctor: ComponentCtor<T>): T {
  return node.getComponent(ctor) || node.addComponent(ctor);
}

export function createLabel(parent: Node, name: string, text: string, position = Vec3.ZERO): Label {
  const node = ensureChild(parent, name);
  node.layer = Layers.Enum.UI_2D;
  node.setPosition(position === Vec3.ZERO ? nextAutoPosition(parent) : position);
  ensureComponent(node, UITransform).setContentSize(760, 48);
  const label = ensureComponent(node, Label);
  label.string = text;
  (label as Label & { color?: Color; fontSize?: number; lineHeight?: number }).color = Color.WHITE;
  (label as Label & { color?: Color; fontSize?: number; lineHeight?: number }).fontSize = 28;
  (label as Label & { color?: Color; fontSize?: number; lineHeight?: number }).lineHeight = 36;
  return label;
}

export function createPanel(parent: Node, name: string, width: number, height: number, color: Color, position = Vec3.ZERO): Node {
  const node = ensureChild(parent, name);
  node.layer = Layers.Enum.UI_2D;
  node.setPosition(position);
  ensureComponent(node, UITransform).setContentSize(width, height);
  const sprite = ensureComponent(node, Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.color = color;
  return node;
}

export function createImage(parent: Node, name: string, path: string, width: number, height: number, position = Vec3.ZERO): Node {
  const node = ensureChild(parent, name);
  node.layer = Layers.Enum.UI_2D;
  node.setPosition(position);
  ensureComponent(node, UITransform).setContentSize(width, height);
  const sprite = ensureComponent(node, Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.color = Color.WHITE;
  loadSpriteFrame(sprite, path);
  return node;
}

export function createRemoteImage(parent: Node, name: string, url: string, fallbackPath: string, width: number, height: number, position = Vec3.ZERO): Node {
  const node = createImage(parent, name, fallbackPath, width, height, position);
  const sprite = ensureComponent(node, Sprite);
  if (!url) return node;

  const remoteLoader = assetManager as {
    loadRemote<T>(remoteUrl: string, callback: (err: Error | null, asset: T | null) => void): void;
  };

  remoteLoader.loadRemote<unknown>(url, (err, imageAsset) => {
    if (err || !imageAsset) {
      console.warn(`[RuntimeUi] failed to load remote image: ${url}`, err);
      return;
    }

    const texture = new Texture2D();
    (texture as Texture2D & { image?: unknown }).image = imageAsset;
    const frame = new SpriteFrame();
    frame.texture = texture;
    sprite.spriteFrame = frame;
  });

  return node;
}

export function createButton(parent: Node, name: string, text: string, onClick: () => void, position = Vec3.ZERO): Node {
  const node = ensureChild(parent, name);
  node.layer = Layers.Enum.UI_2D;
  node.setPosition(position === Vec3.ZERO ? nextAutoPosition(parent) : position);
  ensureComponent(node, UITransform).setContentSize(220, 64);
  const sprite = ensureComponent(node, Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.color = new Color(36, 142, 109, 255);
  ensureComponent(node, Button);
  node.off('touch-end', onClick);
  node.on('touch-end', onClick);
  const label = createLabel(node, 'Label', text, new Vec3(0, 0, 0));
  (label as Label & { fontSize?: number; lineHeight?: number }).fontSize = 24;
  (label as Label & { fontSize?: number; lineHeight?: number }).lineHeight = 30;
  const button = ensureComponent(node, Button) as Button & { clickEvents?: unknown[] };
  if ('clickEvents' in button) button.clickEvents = [];
  return node;
}

export function createImageButton(
  parent: Node,
  name: string,
  text: string,
  imagePath: string,
  onClick: () => void,
  position = Vec3.ZERO,
  width = 260,
  height = 82,
): Node {
  const node = createButton(parent, name, text, onClick, position);
  ensureComponent(node, UITransform).setContentSize(width, height);
  loadSpriteFrame(ensureComponent(node, Sprite), imagePath);
  return node;
}

export function ensureView<T extends Component>(parent: Node, name: string, ctor: ComponentCtor<T>, position = Vec3.ZERO): T {
  const node = ensureChild(parent, name);
  node.layer = Layers.Enum.UI_2D;
  node.setPosition(position);
  return ensureComponent(node, ctor);
}

function nextAutoPosition(parent: Node): Vec3 {
  const visibleChildren = parent.children.filter((child) => child.name !== 'RuntimeCamera');
  const index = Math.max(0, visibleChildren.length - 1);
  return new Vec3(0, 240 - index * 72, 0);
}

function getViewportSize() {
  const visible = view.getVisibleSize();
  const design = view.getDesignResolutionSize();
  const designWidth = design.width || 0;
  const designHeight = design.height || 0;

  if (designWidth > 0 && designHeight > 0) {
    return {
      width: designWidth,
      height: designHeight,
    };
  }

  return {
    width: visible.width || design.width || 750,
    height: visible.height || design.height || 1334,
  };
}

function loadSpriteFrame(sprite: Sprite, path: string): void {
  resources.load(`${path}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
    if (!err && spriteFrame) {
      sprite.spriteFrame = spriteFrame;
      console.log(`[RuntimeUi] loaded spriteFrame: ${path}/spriteFrame`);
      return;
    }
    resources.load(`${path}/texture`, Texture2D, (textureErr, texture) => {
      if (!textureErr && texture) {
        const frame = new SpriteFrame() as SpriteFrame & { texture?: Texture2D };
        frame.texture = texture;
        sprite.spriteFrame = frame;
        console.log(`[RuntimeUi] loaded texture: ${path}/texture`);
      } else {
        resources.load(path, Texture2D, (directTextureErr, directTexture) => {
          if (!directTextureErr && directTexture) {
            const frame = new SpriteFrame() as SpriteFrame & { texture?: Texture2D };
            frame.texture = directTexture;
            sprite.spriteFrame = frame;
            console.log(`[RuntimeUi] loaded texture: ${path}`);
          } else {
            console.warn(`[RuntimeUi] failed to load sprite: ${path}`, err || textureErr || directTextureErr);
          }
        });
      }
    });
  });
}
