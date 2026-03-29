import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from './helpers/test-app'
import { uniqueEmail, TEST_PASSWORD } from './helpers/test-users'
import { MailService } from '../../mail/mail.service'

describe('Auth flow E2E: register -> verify -> login -> me -> refresh -> logout -> denied', () => {
  let app: INestApplication
  let capturedVerificationToken: string

  beforeAll(async () => {
    app = await createTestApp()

    const mailService = app.get(MailService)
    vi.spyOn(mailService, 'sendVerificationEmail').mockImplementation(
      async (_email: string, token: string) => {
        capturedVerificationToken = token
      },
    )
  })

  afterAll(async () => {
    await app.close()
  })

  it('completes the full auth lifecycle', async () => {
    const email = uniqueEmail('e2e')
    const server = app.getHttpServer()

    // 1. Register
    const registerRes = await request(server)
      .post('/api/auth/register')
      .send({ email, password: TEST_PASSWORD })

    expect(registerRes.status).toBe(200)
    expect(capturedVerificationToken).toBeTruthy()

    // 2. Login should fail (not verified)
    const loginBeforeVerify = await request(server)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })

    expect(loginBeforeVerify.status).toBe(403)

    // 3. Verify email
    const verifyRes = await request(server)
      .post('/api/auth/verify-email')
      .send({ token: capturedVerificationToken })

    expect(verifyRes.status).toBe(200)

    // 4. Login (should succeed now)
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })

    expect(loginRes.status).toBe(200)
    const cookies = loginRes.headers['set-cookie'] as unknown as string[]
    expect(cookies).toBeDefined()

    // 5. Access protected route
    const meRes = await request(server)
      .get('/api/auth/me')
      .set('Cookie', cookies)

    expect(meRes.status).toBe(200)
    expect(meRes.body.email).toBe(email)

    // 6. Refresh token
    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))!
    const refreshRes = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie])

    expect(refreshRes.status).toBe(200)
    const newCookies = refreshRes.headers['set-cookie'] as unknown as string[]
    expect(newCookies).toBeDefined()

    // 7. Logout with new cookies
    const logoutRes = await request(server)
      .post('/api/auth/logout')
      .set('Cookie', newCookies)

    expect(logoutRes.status).toBe(200)

    // 8. Refresh with token from step 6 should fail (revoked by logout)
    const newRefreshCookie = newCookies.find((c: string) => c.startsWith('refresh_token='))!
    const postLogoutRefresh = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', [newRefreshCookie])

    expect(postLogoutRefresh.status).toBe(401)
  })
})
