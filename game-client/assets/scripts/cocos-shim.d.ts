declare module 'cc' {
  export class Component {
    node: Node;
    schedule?(callback: () => void, interval?: number): void;
    scheduleOnce?(callback: () => void, delay?: number): void;
    unschedule?(callback: () => void): void;
    update?(dt: number): void;
  }
  export class Node {
    constructor(name?: string);
    active: boolean;
    layer: number;
    name: string;
    children: Node[];
    parent: Node | null;
    position: Vec3;
    scale: Vec3;
    angle: number;
    setPosition(x: number | Vec3, y?: number, z?: number): void;
    setScale(x: number | Vec3, y?: number, z?: number): void;
    addChild(node: Node): void;
    removeAllChildren(): void;
    addComponent<T>(ctor: new (...args: never[]) => T): T;
    getComponent<T>(ctor: new (...args: never[]) => T): T | null;
    getComponents<T>(ctor: new (...args: never[]) => T): T[];
    on(type: string, callback: (...args: never[]) => void, target?: unknown): void;
    off(type: string, callback: (...args: never[]) => void, target?: unknown): void;
  }
  export class Rect { constructor(x?: number, y?: number, width?: number, height?: number); x: number; y: number; width: number; height: number; }
  export class SpriteFrame { texture: Texture2D; rect: Rect; }
  export class Texture2D { width: number; height: number; }
  export class Sprite {
    static SizeMode: { CUSTOM: number; TRIMMED: number; RAW: number };
    spriteFrame: SpriteFrame | null;
    color: Color;
    sizeMode: number;
  }
  export class Label extends Component { string: string; color: Color; fontSize: number; lineHeight: number; }
  export class Button {}
  export class Color { constructor(r?: number, g?: number, b?: number, a?: number); static WHITE: Color; static BLACK: Color; }
  export class Camera {
    static ProjectionType: { ORTHO: number; PERSPECTIVE: number };
    projection: number;
    visibility: number;
    orthoHeight: number;
  }
  export class Canvas { cameraComponent: Camera | null; }
  export class Prefab {}
  export class AudioClip { duration: number; }
  export class AudioSource {
    clip: AudioClip | null;
    loop: boolean;
    playOnAwake: boolean;
    playing: boolean;
    volume: number;
    play(): void;
    pause(): void;
    stop(): void;
    playOneShot(clip: AudioClip, volume?: number): void;
  }
  export class Vec3 { constructor(x?: number, y?: number, z?: number); x: number; y: number; z: number; static ZERO: Vec3; }
  export class Size { constructor(width?: number, height?: number); width: number; height: number; }
  export class UITransform { width: number; height: number; setContentSize(width: number, height: number): void; }
  export class Graphics extends Component {
    fillColor: Color;
    strokeColor: Color;
    lineWidth: number;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
    circle(cx: number, cy: number, r: number): void;
    rect(x: number, y: number, w: number, h: number): void;
    roundRect(x: number, y: number, w: number, h: number, r: number): void;
    close(): void;
    stroke(): void;
    fill(): void;
    clear(): void;
  }
  export interface AssetBundle {
    loadDir(
      path: string,
      onProgress: (finished: number, total: number, item: unknown) => void,
      onComplete: (err: Error | null, assets: unknown[]) => void,
    ): void;
  }
  export class View { getVisibleSize(): Size; getDesignResolutionSize(): Size; }
  export class EventTarget { on(type: string, callback: (...args: never[]) => void, target?: unknown): void; off(type: string, callback: (...args: never[]) => void, target?: unknown): void; emit(type: string, ...args: unknown[]): void; }
  export const _decorator: {
    ccclass: (name: string) => ClassDecorator;
    property: (...args: unknown[]) => PropertyDecorator;
  };
  export function instantiate(prefab: Prefab): Node;
  export interface TweenLike {
    set(props: Record<string, unknown>): TweenLike;
    to(duration: number, props: Record<string, unknown>, opts?: Record<string, unknown>): TweenLike;
    by(duration: number, props: Record<string, unknown>, opts?: Record<string, unknown>): TweenLike;
    call(fn: () => void): TweenLike;
    repeatForever(action?: TweenLike): TweenLike;
    start(): TweenLike;
    stop(): TweenLike;
  }
  export const tween: (target: unknown) => TweenLike;
  export const resources: { load<T>(path: string, type: new (...args: never[]) => T, cb: (err: Error | null, asset: T) => void): void };
  export const assetManager: unknown;
  export class Game {
    static EVENT_HIDE: string;
    static EVENT_SHOW: string;
  }
  export class Input {
    static EventType: {
      TOUCH_START: string;
      MOUSE_DOWN: string;
    };
  }
  export const game: {
    on(type: string, callback: (...args: never[]) => void, target?: unknown): void;
    off(type: string, callback: (...args: never[]) => void, target?: unknown): void;
  };
  export const input: {
    on(type: string, callback: (...args: never[]) => void, target?: unknown): void;
    off(type: string, callback: (...args: never[]) => void, target?: unknown): void;
  };
  export const director: {
    loadScene(name: string, onLaunched?: () => void): void;
    addPersistRootNode(node: Node): void;
  };
  export const view: View;
  export const sys: { localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } };
  export const Layers: { Enum: { UI_2D: number } };
}
