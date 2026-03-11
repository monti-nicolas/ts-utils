import { TypedEventEmitter } from '../src/event/typed-event-emitter'

// Define a concrete event map for testing.
// This is the same pattern a consumer would use.
type TestEvents = {
  'data:received': { id: number; value: string }
  'connection:closed': { reason: string }
  'ping': void
}

describe('TypedEventEmitter', () => {
  let emitter: TypedEventEmitter<TestEvents>

  beforeEach(() => {
    emitter = new TypedEventEmitter<TestEvents>()
  })

  describe('on / emit', () => {
    it('calls a registered listener with the correct payload', () => {
      const listener = jest.fn()
      emitter.on('data:received', listener)
      emitter.emit('data:received', { id: 1, value: 'hello' })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ id: 1, value: 'hello' })
    })

    it('calls multiple listeners for the same event', () => {
      const l1 = jest.fn()
      const l2 = jest.fn()
      emitter.on('data:received', l1)
      emitter.on('data:received', l2)
      emitter.emit('data:received', { id: 2, value: 'world' })

      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
    })

    it('does not call listeners for other events', () => {
      const listener = jest.fn()
      emitter.on('data:received', listener)
      emitter.emit('connection:closed', { reason: 'timeout' })

      expect(listener).not.toHaveBeenCalled()
    })

    it('returns an unsubscribe function', () => {
      const listener = jest.fn()
      const unsub = emitter.on('data:received', listener)

      unsub()
      emitter.emit('data:received', { id: 3, value: 'after unsub' })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('once', () => {
    it('fires only on the first emit', () => {
      const listener = jest.fn()
      emitter.once('data:received', listener)

      emitter.emit('data:received', { id: 1, value: 'first' })
      emitter.emit('data:received', { id: 2, value: 'second' })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ id: 1, value: 'first' })
    })

    it('can be cancelled before it fires', () => {
      const listener = jest.fn()
      const unsub = emitter.once('data:received', listener)

      unsub()
      emitter.emit('data:received', { id: 1, value: 'test' })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('off', () => {
    it('removes a specific listener', () => {
      const l1 = jest.fn()
      const l2 = jest.fn()

      emitter.on('data:received', l1)
      emitter.on('data:received', l2)
      emitter.off('data:received', l1)

      emitter.emit('data:received', { id: 1, value: 'test' })

      expect(l1).not.toHaveBeenCalled()
      expect(l2).toHaveBeenCalledTimes(1)
    })

    it('is a no-op for events with no listeners', () => {
      // Should not throw
      expect(() => {
        emitter.off('data:received', jest.fn())
      }).not.toThrow()
    })
  })

  describe('clear', () => {
    it('removes all listeners for a specific event', () => {
      const l1 = jest.fn()
      const l2 = jest.fn()

      emitter.on('data:received', l1)
      emitter.on('connection:closed', l2)
      emitter.clear('data:received')

      emitter.emit('data:received', { id: 1, value: 'test' })
      emitter.emit('connection:closed', { reason: 'done' })

      expect(l1).not.toHaveBeenCalled()
      expect(l2).toHaveBeenCalledTimes(1)
    })

    it('removes all listeners across all events', () => {
      const l1 = jest.fn()
      const l2 = jest.fn()

      emitter.on('data:received', l1)
      emitter.on('connection:closed', l2)
      emitter.clear()

      emitter.emit('data:received', { id: 1, value: 'test' })
      emitter.emit('connection:closed', { reason: 'done' })

      expect(l1).not.toHaveBeenCalled()
      expect(l2).not.toHaveBeenCalled()
    })
  })

  describe('listenerCount', () => {
    it('returns the number of listeners for an event', () => {
      expect(emitter.listenerCount('data:received')).toBe(0)

      const unsub1 = emitter.on('data:received', jest.fn())
      expect(emitter.listenerCount('data:received')).toBe(1)

      emitter.on('data:received', jest.fn())
      expect(emitter.listenerCount('data:received')).toBe(2)

      unsub1()
      expect(emitter.listenerCount('data:received')).toBe(1)
    })
  })

  describe('emit during iteration safety', () => {
    it('does not skip listeners if a listener calls off during emit', () => {
      const l2 = jest.fn()

      // l1 unsubscribes itself during the emit
      const l1 = jest.fn(() => {
        emitter.off('data:received', l1)
      })

      emitter.on('data:received', l1)
      emitter.on('data:received', l2)

      emitter.emit('data:received', { id: 1, value: 'test' })

      // Both should have been called despite l1 removing itself mid-emit
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
    })
  })
})
