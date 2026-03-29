import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from '../helpers/test-app'

describe('POST /api/auth/verify-email (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects invalid token with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: 'invalid-token-abc123' })

    expect(res.status).toBe(400)
  })

  it('rejects empty token with 400 (validation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: '' })

    expect(res.status).toBe(400)
  })

  it('rejects missing token field with 400', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/verify-email').send({})

    expect(res.status).toBe(400)
  })
})
