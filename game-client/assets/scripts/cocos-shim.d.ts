declare module 'cc' {
  export class Component {
    node: Node;
    schedule?(callback: () => void, interval?: number): void;
    unschedule?(callback: () => void): void;
  }
  export class Node {
    active: boolean;
    name: string;
    children: Node[];
    position: Vec3;
    setPosition(x: number | Vec3, y?: number, z?: number): void;
    addChild(node: Node): void;
    removeAllChildren(): void;
    getComponent<T>(ctor: new (...args: never[]) => T): T | null;
    on(type: string, callback: (...args: never[]) => void, target?: unknown): void;
    off(type: string, callback: (...args: never[]) => void, target?: unknown): void;
  }
  export class SpriteFrame {}
  export class Sprite { spriteFrame: SpriteFrame | null; }
  export class Label { string: string; }
  export class Prefab {}
  export class AudioClip {}
  export class AudioSource { clip: AudioClip | null; volume: number; playOneShot(clip: AudioClip, volume?: number): void; }
  export class Vec3 { constructor(x?: number, y?: number, z?: number); x: number; y: number; z: number; static ZERO: Vec3; }
  export class Size { constructor(width?: number, height?: number); width: number; height: number; }
  export class UITransform { width: number; height: number; setContentSize(width: number, height: number): void; }
  export class EventTarget { on(type: string, callback: (...args: never[]) => void, target?: unknown): void; off(type: string, callback: (...args: never[]) => void, target?: unknown): void; emit(type: string, ...args: unknown[]): void; }
  export const _decorator: {
    ccclass: (name: string) => ClassDecorator;
    property: (...args: unknown[]) => PropertyDecorator;
  };
  export function instantiate(prefab: Prefab): Node;
  export interface TweenLike {
    to(duration: number, props: Record<string, unknown>, opts?: Record<string, unknown>): TweenLike;
    call(fn: () => void): TweenLike;
    start(): TweenLike;
  }
  export const tween: (target: unknown) => TweenLike;
  export const resources: { load<T>(path: string, type: new (...args: never[]) => T, cb: (err: Error | null, asset: T) => void): void };
  export const assetManager: unknown;
  export const director: { loadScene(name: string): void };
  export const sys: { localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } };
}
