import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from './helpers/test-app'
import { createVerifiedUser, loginAndGetCookies, uniqueEmail } from './helpers/test-users'

describe('Protected routes (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health is public (no auth required)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
  })

  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me returns user profile with valid cookie', async () => {
    const email = uniqueEmail('prot-me')
    await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookies)

    expect(res.status).toBe(200)
    expect(res.body.email).toBe(email)
    expect(res.body.id).toBeDefined()
    expect(res.body.emailVerified).toBe(true)
  })
})
