import { describe, it, expect } from 'vitest'
import { hashString, hashBuffer, verifyHash, machineId } from '../../../src/core/hash.js'

describe('hash', () => {
  describe('hashString', () => {
    it('returns 64-char hex digest', () => {
      const result = hashString('hello')
      expect(result).toHaveLength(64)
      expect(result).toMatch(/^[a-f0-9]+$/)
    })

    it('is deterministic', () => {
      expect(hashString('test')).toBe(hashString('test'))
    })

    it('is different for different inputs', () => {
      expect(hashString('foo')).not.toBe(hashString('bar'))
    })

    it('matches known SHA-256 values', () => {
      // SHA-256 of empty string
      expect(hashString('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })
  })

  describe('hashBuffer', () => {
    it('matches hashString for the same content', () => {
      const str = 'hello world'
      expect(hashBuffer(Buffer.from(str, 'utf-8'))).toBe(hashString(str))
    })
  })

  describe('verifyHash', () => {
    it('returns true for correct hash', () => {
      const content = 'test content'
      const hash = hashString(content)
      expect(verifyHash(content, hash)).toBe(true)
    })

    it('returns false for wrong hash', () => {
      expect(verifyHash('content', 'wronghash')).toBe(false)
    })
  })

  describe('machineId', () => {
    it('returns 12-char hex string', () => {
      const id = machineId()
      expect(id).toHaveLength(12)
      expect(id).toMatch(/^[a-f0-9]+$/)
    })

    it('is deterministic (same machine)', () => {
      expect(machineId()).toBe(machineId())
    })
  })
})
