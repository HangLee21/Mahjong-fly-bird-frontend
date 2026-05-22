export class StateMachine<T extends string> {
  private current: T;
  private transitions = new Map<T, Set<T>>();

  constructor(initial: T) {
    this.current = initial;
  }

  get state(): T {
    return this.current;
  }

  allow(from: T, to: T): void {
    const set = this.transitions.get(from) || new Set<T>();
    set.add(to);
    this.transitions.set(from, set);
  }

  can(to: T): boolean {
    return this.transitions.get(this.current)?.has(to) ?? false;
  }

  transition(to: T): boolean {
    if (!this.can(to)) return false;
    this.current = to;
    return true;
  }
}
