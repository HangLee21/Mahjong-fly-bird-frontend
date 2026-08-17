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
  tween,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { ExperienceEnvironment } from '../app/ExperienceEnvironment';

type ComponentCtor<T> = new (...args: never[]) => T;
const spriteFrameCache = new Map<string, SpriteFrame>();
const spriteFramePending = new Map<string, Array<(frame: SpriteFrame | null, err?: Error) => void>>();
const remoteSpriteFrameCache = new Map<string, SpriteFrame>();
const remoteSpriteFramePending = new Map<string, Array<(frame: SpriteFrame | null) => void>>();
const spriteFrameRequests = new WeakMap<Sprite, string>();
const touchEndHandlers = new WeakMap<Node, () => void>();
const pressFeedbackHandlers = new WeakMap<Node, { start: () => void; end: () => void }>();
// The WeChat simulator can report an unset design size during its first frame.
export const DEFAULT_DESIGN_RESOLUTION: RuntimeSize = { width: 1334, height: 750 };
const RESOLUTION_POLICY_SHOW_ALL = 2;

function relayClientLog(level: 'info' | 'warn' | 'error', msg: string): void {
  try {
    const origin = ExperienceEnvironment.SERVER_ORIGIN.replace(/\/+$/, '');
    const wxApi = (globalThis as {
      wx?: {
        request?: (options: {
          url: string;
          method: 'POST';
          header?: Record<string, string>;
          data?: unknown;
        }) => void;
      };
    }).wx;
    const payload = { level, msg };
    if (wxApi?.request) {
      wxApi.request({
        url: `${origin}/api/debug/client-log`,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: payload,
      });
    } else if (typeof fetch === 'function') {
      fetch(`${origin}/api/debug/client-log`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }
  } catch {
    // Never let debug logging break rendering.
  }
}

export function applyLandscapeResolution(): void {
  const runtimeView = view as unknown as {
    setDesignResolutionSize?: (width: number, height: number, policy: number) => void;
  };
  runtimeView.setDesignResolutionSize?.(
    DEFAULT_DESIGN_RESOLUTION.width,
    DEFAULT_DESIGN_RESOLUTION.height,
    RESOLUTION_POLICY_SHOW_ALL,
  );
}

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

/**
 * Runtime UI is authored against the 1334 x 750 design resolution. Phone text
 * uses a 2x readability scale; fixed art slots must constrain their labels.
 */
export const TEXT_SCALE = 2;

export function createLabel(parent: Node, name: string, text: string, position = Vec3.ZERO): Label {
  const node = ensureChild(parent, name);
  node.layer = Layers.Enum.UI_2D;
  node.setPosition(position === Vec3.ZERO ? nextAutoPosition(parent) : position);
  ensureComponent(node, UITransform).setContentSize(760, 48);
  const label = ensureComponent(node, Label);
  label.string = text;
  const constrainedLabel = label as Label & {
    overflow?: number;
    horizontalAlign?: number;
    verticalAlign?: number;
    enableWrapText?: boolean;
  };
  constrainedLabel.overflow = 2; // Label.Overflow.SHRINK
  constrainedLabel.horizontalAlign = 1;
  constrainedLabel.verticalAlign = 1;
  constrainedLabel.enableWrapText = false;
  (label as Label & { color?: Color; fontSize?: number; lineHeight?: number }).color = Color.WHITE;
  (label as Label & { color?: Color; fontSize?: number; lineHeight?: number }).fontSize = 28 * TEXT_SCALE;
  (label as Label & { color?: Color; fontSize?: number; lineHeight?: number }).lineHeight = 36 * TEXT_SCALE;
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
  if (url.includes('/game-assets/avatars/')) {
    relayClientLog('info', `[RuntimeUi] loading avatar ${url}`);
  }
  const requestKey = `remote:${url}`;
  spriteFrameRequests.set(sprite, requestKey);

  const applyFrame = (frame: SpriteFrame | null): void => {
    if (spriteFrameRequests.get(sprite) !== requestKey) return;
    if (frame) {
      sprite.spriteFrame = frame;
    } else {
      loadSpriteFrame(sprite, fallbackPath);
    }
  };

  const cached = remoteSpriteFrameCache.get(url);
  if (cached) {
    applyFrame(cached);
    return node;
  }

  const pending = remoteSpriteFramePending.get(url);
  if (pending) {
    pending.push(applyFrame);
    return node;
  }
  remoteSpriteFramePending.set(url, [applyFrame]);

  const remoteLoader = assetManager as {
    loadRemote<T>(remoteUrl: string, callback: (err: Error | null, asset: T | null) => void): void;
  };

  const finishRemoteImage = (frame: SpriteFrame | null, err?: Error): void => {
    if (err) {
      console.warn(`[RuntimeUi] failed to load remote image: ${url}`, err);
      if (url.includes('/game-assets/avatars/')) {
        relayClientLog('warn', `[RuntimeUi] failed to load avatar ${url}: ${err.message}`);
      }
    }
    if (frame) remoteSpriteFrameCache.set(url, frame);
    const callbacks = remoteSpriteFramePending.get(url) || [];
    remoteSpriteFramePending.delete(url);
    callbacks.forEach((callback) => callback(frame));
  };

  const wxDownload = (globalThis as {
    wx?: {
      downloadFile?: (options: {
        url: string;
        success: (result: { statusCode: number; tempFilePath?: string; filePath?: string }) => void;
        fail: (error: { errMsg?: string }) => void;
      }) => void;
    };
  }).wx?.downloadFile;

  const loadWithWxDownload = (): void => {
    if (!wxDownload) {
      finishRemoteImage(null, new Error('wx.downloadFile unavailable'));
      return;
    }
    wxDownload({
      url,
      success: (result) => {
        const localPath = result.tempFilePath || result.filePath;
        if (result.statusCode !== 200 || !localPath) {
          finishRemoteImage(null, new Error(`avatar download status ${result.statusCode}`));
          return;
        }
        const ImageCtor = (globalThis as {
          Image?: new () => {
            src: string;
            onload: (() => void) | null;
            onerror: (() => void) | null;
          };
        }).Image;
        if (!ImageCtor) {
          finishRemoteImage(null, new Error('Image constructor unavailable'));
          return;
        }
        const image = new ImageCtor();
        image.onload = () => {
          const texture = new Texture2D();
          (texture as Texture2D & { image?: unknown }).image = image;
          const frame = new SpriteFrame();
          frame.texture = texture;
          finishRemoteImage(frame);
        };
        image.onerror = () => finishRemoteImage(null, new Error('avatar image decode failed'));
        image.src = localPath;
      },
      fail: (error) => finishRemoteImage(null, new Error(error.errMsg || 'wx.downloadFile failed')),
    });
  };

  remoteLoader.loadRemote<unknown>(url, (err, imageAsset) => {
    if (err || !imageAsset) {
      loadWithWxDownload();
      return;
    }
    const texture = new Texture2D();
    (texture as Texture2D & { image?: unknown }).image = imageAsset;
    const frame = new SpriteFrame();
    frame.texture = texture;
    finishRemoteImage(frame);
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
  bindTouchEnd(node, onClick);
  const label = createLabel(node, 'Label', text, new Vec3(0, 0, 0));
  label.string = text;
  ensureComponent(label.node, UITransform).setContentSize(196, 52);
  (label as Label & { fontSize?: number; lineHeight?: number }).fontSize = 24 * TEXT_SCALE;
  (label as Label & { fontSize?: number; lineHeight?: number }).lineHeight = 30 * TEXT_SCALE;
  const button = ensureComponent(node, Button) as Button & { clickEvents?: unknown[] };
  if ('clickEvents' in button) button.clickEvents = [];
  return node;
}

export function bindTouchEnd(node: Node, onClick: () => void): void {
  const previous = touchEndHandlers.get(node);
  if (previous) node.off('touch-end', previous);
  touchEndHandlers.set(node, onClick);
  node.on('touch-end', onClick);
  bindPressFeedback(node);
}

function bindPressFeedback(node: Node): void {
  const previous = pressFeedbackHandlers.get(node);
  if (previous) {
    node.off('touch-start', previous.start);
    node.off('touch-end', previous.end);
    node.off('touch-cancel', previous.end);
  }

  const start = (): void => {
    node.setScale(0.96, 0.96, 1);
  };
  const end = (): void => {
    tween(node).to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
  };
  pressFeedbackHandlers.set(node, { start, end });
  node.on('touch-start', start);
  node.on('touch-end', end);
  node.on('touch-cancel', end);
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

export function createIconButton(
  parent: Node,
  name: string,
  imagePath: string,
  onClick: () => void,
  position = Vec3.ZERO,
  size = 64,
): Node {
  const node = createImage(parent, name, imagePath, size, size, position);
  ensureComponent(node, Button);
  bindTouchEnd(node, onClick);
  return node;
}

export function setButtonImage(node: Node, imagePath: string): void {
  const sprite = ensureComponent(node, Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  loadSpriteFrame(sprite, imagePath);
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
  const design = view.getDesignResolutionSize();
  const designWidth = design.width || 0;
  const designHeight = design.height || 0;

  if (designWidth > 0 && designHeight > 0) {
    return {
      width: designWidth,
      height: designHeight,
    };
  }

  return DEFAULT_DESIGN_RESOLUTION;
}

function loadSpriteFrame(sprite: Sprite, path: string): void {
  const requestKey = `local:${path}`;
  spriteFrameRequests.set(sprite, requestKey);
  const applyFrame = (frame: SpriteFrame | null): void => {
    if (frame && spriteFrameRequests.get(sprite) === requestKey) {
      sprite.spriteFrame = frame;
    }
  };
  const cached = spriteFrameCache.get(path);
  if (cached) {
    applyFrame(cached);
    return;
  }

  const waiters = spriteFramePending.get(path);
  if (waiters) {
    waiters.push(applyFrame);
    return;
  }

  spriteFramePending.set(path, [applyFrame]);

  const finish = (frame: SpriteFrame | null, err?: Error): void => {
    if (frame) spriteFrameCache.set(path, frame);
    const callbacks = spriteFramePending.get(path) || [];
    spriteFramePending.delete(path);
    callbacks.forEach((callback) => callback(frame, err));
  };

  resources.load(`${path}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
    if (!err && spriteFrame) {
      finish(spriteFrame);
      return;
    }
    resources.load(`${path}/texture`, Texture2D, (textureErr, texture) => {
      if (!textureErr && texture) {
        const frame = new SpriteFrame() as SpriteFrame & { texture?: Texture2D };
        frame.texture = texture;
        finish(frame);
      } else {
        resources.load(path, Texture2D, (directTextureErr, directTexture) => {
          if (!directTextureErr && directTexture) {
            const frame = new SpriteFrame() as SpriteFrame & { texture?: Texture2D };
            frame.texture = directTexture;
            finish(frame);
          } else {
            const loadErr = err || textureErr || directTextureErr || undefined;
            console.warn(`[RuntimeUi] failed to load sprite: ${path}`, loadErr);
            finish(null, loadErr);
          }
        });
      }
    });
  });
}
