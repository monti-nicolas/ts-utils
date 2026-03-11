import { Logger } from '../src/logger/logger'
import type { LogEntry } from '../src/logger/logger'

describe('Logger', () => {
  /** Capture log entries into an array instead of writing to console. */
  function captureTransport(): { entries: LogEntry[]; transport: (e: LogEntry) => void } {
    const entries: LogEntry[] = []
    return { entries, transport: (e) => entries.push(e) }
  }

  describe('log level filtering', () => {
    it('emits nothing when level is silent (default)', () => {
      const { entries, transport } = captureTransport()
      const logger = new Logger({ transport })

      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      expect(entries).toHaveLength(0)
    })

    it('only emits messages at or above the configured level', () => {
      const { entries, transport } = captureTransport()
      const logger = new Logger({ level: 'warn', transport })

      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      expect(entries).toHaveLength(2)
      expect(entries[0]?.level).toBe('warn')
      expect(entries[1]?.level).toBe('error')
    })

    it('emits all levels when level is debug', () => {
      const { entries, transport } = captureTransport()
      const logger = new Logger({ level: 'debug', transport })

      logger.debug('a')
      logger.info('b')
      logger.warn('c')
      logger.error('d')

      expect(entries).toHaveLength(4)
    })
  })

  describe('log entry structure', () => {
    it('includes all required fields', () => {
      const { entries, transport } = captureTransport()
      const logger = new Logger({ level: 'info', prefix: 'test-sdk', transport })

      logger.info('Something happened', { requestId: 'abc-123' })

      const entry = entries[0]!
      expect(entry.level).toBe('info')
      expect(entry.prefix).toBe('test-sdk')
      expect(entry.message).toBe('Something happened')
      expect(entry.context).toEqual({ requestId: 'abc-123' })
      expect(typeof entry.timestamp).toBe('string')
      // Timestamp should be a valid ISO 8601 date string
      expect(() => new Date(entry.timestamp)).not.toThrow()
    })

    it('omits context field when no context is passed', () => {
      const { entries, transport } = captureTransport()
      const logger = new Logger({ level: 'info', transport })

      logger.info('No context here')

      expect(entries[0]).not.toHaveProperty('context')
    })
  })

  describe('child logger', () => {
    it('inherits level and transport from parent', () => {
      const { entries, transport } = captureTransport()
      const parent = new Logger({ level: 'info', prefix: 'sdk', transport })
      const child = parent.child('network')

      child.debug('should be filtered')
      child.info('should pass')

      expect(entries).toHaveLength(1)
      expect(entries[0]?.level).toBe('info')
    })

    it('appends to the parent prefix with a colon separator', () => {
      const { entries, transport } = captureTransport()
      const parent = new Logger({ level: 'info', prefix: 'sdk', transport })
      const child = parent.child('network')
      const grandchild = child.child('retry')

      grandchild.info('deep log')

      expect(entries[0]?.prefix).toBe('sdk:network:retry')
    })
  })

  describe('default console transport', () => {
    it('calls console.debug for debug level', () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const logger = new Logger({ level: 'debug', prefix: 'test' })
      logger.debug('test message')
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('calls console.info for info level', () => {
      const spy = jest.spyOn(console, 'info').mockImplementation(() => {})
      const logger = new Logger({ level: 'info', prefix: 'test' })
      logger.info('test message')
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('calls console.warn for warn level', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const logger = new Logger({ level: 'warn', prefix: 'test' })
      logger.warn('test message')
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('calls console.error for error level', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new Logger({ level: 'error', prefix: 'test' })
      logger.error('test message')
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })
})
