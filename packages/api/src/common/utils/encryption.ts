import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16;

function parseKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `PAYMENT_ENCRYPTION_KEY must be 32 bytes when decoded. Got ${key.length} bytes.`,
    );
  }
  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64 string in the format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string, base64Key: string): string {
  const key = parseKey(base64Key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

/**
 * Decrypts a value produced by encrypt().
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decrypt(encryptedValue: string, base64Key: string): string {
  const key = parseKey(base64Key);
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format. Expected iv:authTag:ciphertext');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length in encrypted value');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length in encrypted value');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
