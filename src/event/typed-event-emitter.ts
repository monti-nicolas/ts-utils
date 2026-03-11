import type { Unsubscribe } from '../types/shared'

/**
 * TypedEventEmitter
 *
 * A fully type-safe event emitter where the event map is defined upfront.
 * TypeScript will enforce that:
 *   - You can only emit events that exist in TEvents
 *   - The payload type matches the event's definition
 *   - Listeners receive the correct payload type — no casting needed
 *
 * Why not just use Node's EventEmitter?
 *   Node's EventEmitter uses `any` for payloads. In a strict TypeScript
 *   codebase (especially an SDK), that's a type safety hole. This
 *   implementation gives you compile-time guarantees.
 *
 * Usage:
 *   type AppEvents = {
 *     'user:login': { userId: string; timestamp: number }
 *     'user:logout': { userId: string }
 *     'error': Error
 *   }
 *
 *   const emitter = new TypedEventEmitter<AppEvents>()
 *
 *   emitter.on('user:login', ({ userId }) => console.log(userId)) // ✅
 *   emitter.emit('user:login', { userId: '123', timestamp: Date.now() })   // ✅
 *   emitter.emit('user:login', { userId: 123 })  // ❌ TS error: number not assignable to string
 */
export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  // The listeners map mirrors the shape of TEvents but each key holds
  // an array of listener functions. The mapped type ensures payload
  // types stay in sync with TEvents automatically.
  private listeners: {
    [K in keyof TEvents]?: Array<(payload: TEvents[K]) => void>
  } = {}

  /**
   * Register a listener for an event.
   * Returns an unsubscribe function — useful for cleanup in SDK teardown.
   *
   *   const unsub = emitter.on('error', handleError)
   *   // later...
   *   unsub()
   */
  on<K extends keyof TEvents>(
    eventName: K,
    listener: (payload: TEvents[K]) => void
  ): Unsubscribe {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }
    this.listeners[eventName]!.push(listener)

    // Return a cleanup function. This pattern is common in SDKs because
    // consumers need a way to detach listeners when a component unmounts
    // or the SDK is torn down.
    return () => this.off(eventName, listener)
  }

  /**
   * Register a one-time listener. It fires once then automatically removes itself.
   * Useful for "wait for initialisation complete" patterns.
   */
  once<K extends keyof TEvents>(
    eventName: K,
    listener: (payload: TEvents[K]) => void
  ): Unsubscribe {
    const wrapper = (payload: TEvents[K]) => {
      listener(payload)
      this.off(eventName, wrapper)
    }
    return this.on(eventName, wrapper)
  }

  /**
   * Emit an event, synchronously invoking all registered listeners.
   *
   * Why synchronous?
   * Async event emitters introduce ordering complexity and make errors
   * harder to trace. For an SDK utility, synchronous is predictable.
   */
  emit<K extends keyof TEvents>(eventName: K, payload: TEvents[K]): void {
    // Snapshot the array before iterating. If a listener calls `off`
    // during emission, we don't want to mutate the array mid-loop.
    const eventListeners = this.listeners[eventName]?.slice()
    if (!eventListeners) return

    for (const listener of eventListeners) {
      listener(payload)
    }
  }

  /** Remove a specific listener for an event. */
  off<K extends keyof TEvents>(
    eventName: K,
    listener: (payload: TEvents[K]) => void
  ): void {
    const eventListeners = this.listeners[eventName]
    if (!eventListeners) return
    this.listeners[eventName] = eventListeners.filter((l) => l !== listener)
  }

  /** Remove all listeners, optionally scoped to a single event. */
  clear(eventName?: keyof TEvents): void {
    if (eventName !== undefined) {
      delete this.listeners[eventName]
    } else {
      this.listeners = {}
    }
  }

  /** Returns the number of listeners registered for a given event. */
  listenerCount(eventName: keyof TEvents): number {
    return this.listeners[eventName]?.length ?? 0
  }
}
