export function throttle<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let last = 0;
  return function throttled(this: unknown, ...args: never[]) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  } as T;
}
