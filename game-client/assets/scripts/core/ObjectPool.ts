export class ObjectPool<T> {
  private items: T[] = [];
  constructor(private readonly create: () => T, private readonly reset?: (item: T) => void) {}

  acquire(): T {
    return this.items.pop() || this.create();
  }

  release(item: T): void {
    this.reset?.(item);
    this.items.push(item);
  }

  clear(): void {
    this.items = [];
  }
}
