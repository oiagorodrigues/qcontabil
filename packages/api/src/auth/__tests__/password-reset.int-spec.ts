import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from './helpers/test-app'
import { createVerifiedUser, uniqueEmail } from './helpers/test-users'

describe('Password reset flow (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/auth/forgot-password', () => {
    it('returns generic success for existing email (no enumeration)', async () => {
      const email = uniqueEmail('forgot-exists')
      await createVerifiedUser(app, email)

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('reset link')
    })

    it('returns same generic success for nonexistent email (no enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: uniqueEmail('forgot-none') })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('reset link')
    })

    it('rejects invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-email' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/reset-password', () => {
    it('rejects invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: 'bad-token', password: 'NewStr0ngPass!' })

      expect(res.status).toBe(400)
    })

    it('rejects short password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: 'any-token', password: 'short' })

      expect(res.status).toBe(400)
    })
  })
})
