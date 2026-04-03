# AES-256-GCM Encryption in Node.js

## Context

Storing payment provider credentials (API keys) at rest in the database. AES-256-GCM provides authenticated encryption — the auth tag catches tampering without needing a separate HMAC.

## Pattern

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Key: 32 bytes stored as base64 in env var (PAYMENT_ENCRYPTION_KEY)
// Format stored in DB: base64(iv):base64(authTag):base64(ciphertext)

function encrypt(plaintext: string, base64Key: string): string {
  const key = Buffer.from(base64Key, 'base64')
  if (key.length !== 32) throw new Error('Key must be 32 bytes')

  const iv = randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

function decrypt(encrypted: string, base64Key: string): string {
  const key = Buffer.from(base64Key, 'base64')
  if (key.length !== 32) throw new Error('Key must be 32 bytes')

  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
```

## Key Points

- **IV**: Always random per encryption (`randomBytes(12)`). Same plaintext → different ciphertext every time. Store IV with the ciphertext.
- **Auth tag**: GCM produces a 16-byte authentication tag. If ciphertext is tampered, `decipher.final()` throws — no need for separate HMAC.
- **Key rotation**: Changing `PAYMENT_ENCRYPTION_KEY` requires re-encrypting all existing values. Plan for this before prod.
- **32-byte validation**: Explicitly check `key.length !== 32` before encrypting — `createCipheriv` may silently truncate or fail cryptically.

## Generating a key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Testing

Test the tampered ciphertext case explicitly — flip a character in the ciphertext part (not the IV or authTag) to verify GCM auth tag detection:

```typescript
const parts = ciphertext.split(':')
parts[2] = parts[2].slice(0, -2) + 'AA'
expect(() => decrypt(parts.join(':'), key)).toThrow()
```
