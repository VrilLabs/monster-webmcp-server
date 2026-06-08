/**
 * MonsterWebMCP - Type-Safe Event Emitter
 * Zero-dependency, type-safe event system for tool change notifications
 */

export type EventMap = { [key: string]: unknown };

export type EventKey<T extends EventMap> = keyof T & string;
export type EventCallback<T> = T extends undefined ? () => void : (data: T) => void;

interface ListenerEntry<T> {
  callback: EventCallback<T>;
  once: boolean;
}

export class TypeSafeEventEmitter<Events extends EventMap> {
  private listeners: Map<string, ListenerEntry<unknown>[]> = new Map();
  private onceListeners: Map<string, ListenerEntry<unknown>[]> = new Map();

  /**
   * Subscribe to an event
   */
  on<K extends EventKey<Events>>(event: K, callback: EventCallback<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const entry: ListenerEntry<Events[K]> = { callback, once: false };
    this.listeners.get(event)!.push(entry as ListenerEntry<unknown>);

    // Return unsubscribe function
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(entry as ListenerEntry<unknown>);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      }
    };
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first emission
   */
  once<K extends EventKey<Events>>(event: K, callback: EventCallback<Events[K]>): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    const entry: ListenerEntry<Events[K]> = { callback, once: true };
    this.onceListeners.get(event)!.push(entry as ListenerEntry<unknown>);

    return () => {
      const list = this.onceListeners.get(event);
      if (list) {
        const idx = list.indexOf(entry as ListenerEntry<unknown>);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      }
    };
  }

  /**
   * Emit an event to all subscribers
   */
  emit<K extends EventKey<Events>>(event: K, data?: Events[K]): void {
    // Regular listeners
    const list = this.listeners.get(event);
    if (list) {
      for (const entry of list) {
        try {
          if (data === undefined) {
            (entry.callback as () => void)();
          } else {
            (entry.callback as (d: Events[K]) => void)(data);
          }
        } catch {
          // Swallow errors in listener callbacks to prevent one failing listener from breaking others
        }
      }
    }

    // Once listeners
    const onceList = this.onceListeners.get(event);
    if (onceList && onceList.length > 0) {
      const entries = onceList.splice(0);
      for (const entry of entries) {
        try {
          if (data === undefined) {
            (entry.callback as () => void)();
          } else {
            (entry.callback as (d: Events[K]) => void)(data);
          }
        } catch {
          // Swallow errors
        }
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events
   */
  off<K extends EventKey<Events>>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends EventKey<Events>>(event: K): number {
    const regular = this.listeners.get(event)?.length ?? 0;
    const once = this.onceListeners.get(event)?.length ?? 0;
    return regular + once;
  }

  /**
   * Remove all listeners
   */
  destroy(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }
}
