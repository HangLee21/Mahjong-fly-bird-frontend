type Handler<T = unknown> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on<T>(event: string, handler: Handler<T>): void {
    const set = this.listeners.get(event) || new Set<Handler>();
    set.add(handler as Handler);
    this.listeners.set(event, set);
  }

  off<T>(event: string, handler: Handler<T>): void {
    this.listeners.get(event)?.delete(handler as Handler);
  }

  emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }
}

export const eventBus = new EventBus();
