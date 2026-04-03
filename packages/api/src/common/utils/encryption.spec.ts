import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './encryption'

// Valid 32-byte base64 key for tests
const TEST_KEY = Buffer.alloc(32, 'a').toString('base64')

describe('encryption', () => {
  describe('encrypt / decrypt roundtrip', () => {
    it('returns the original plaintext after roundtrip', () => {
      const plaintext = 'hello world'
      const ciphertext = encrypt(plaintext, TEST_KEY)
      expect(decrypt(ciphertext, TEST_KEY)).toBe(plaintext)
    })

    it('handles JSON payloads correctly', () => {
      const payload = JSON.stringify({ apiKey: 'secret-key', payerEntity: 'acme', sandboxMode: true })
      const ciphertext = encrypt(payload, TEST_KEY)
      expect(decrypt(ciphertext, TEST_KEY)).toBe(payload)
    })

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same text'
      const c1 = encrypt(plaintext, TEST_KEY)
      const c2 = encrypt(plaintext, TEST_KEY)
      expect(c1).not.toBe(c2)
    })

    it('ciphertext has iv:authTag:ciphertext format', () => {
      const ciphertext = encrypt('test', TEST_KEY)
      const parts = ciphertext.split(':')
      expect(parts).toHaveLength(3)
    })
  })

  describe('invalid key', () => {
    it('throws when key is wrong length', () => {
      expect(() => encrypt('test', Buffer.alloc(16, 'a').toString('base64'))).toThrow()
    })

    it('throws when decrypting with wrong key', () => {
      const ciphertext = encrypt('test', TEST_KEY)
      const wrongKey = Buffer.alloc(32, 'b').toString('base64')
      expect(() => decrypt(ciphertext, wrongKey)).toThrow()
    })
  })

  describe('tampered ciphertext', () => {
    it('throws when ciphertext is tampered (GCM auth tag fails)', () => {
      const ciphertext = encrypt('sensitive data', TEST_KEY)
      const parts = ciphertext.split(':')
      // Flip a character in the encrypted payload part
      parts[2] = parts[2].slice(0, -2) + 'AA'
      const tampered = parts.join(':')
      expect(() => decrypt(tampered, TEST_KEY)).toThrow()
    })
  })
})
