import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from './helpers/test-app'
import { createVerifiedUser, loginAndGetCookies, uniqueEmail } from './helpers/test-users'

describe('POST /api/auth/logout (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('clears cookies and returns success', async () => {
    const email = uniqueEmail('logout')
    await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookies)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Logged out')
  })

  it('after logout, refresh token is revoked', async () => {
    const email = uniqueEmail('logout-revoke')
    await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, email)

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookies)

    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))!
    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie])

    expect(refreshRes.status).toBe(401)
  })
})
