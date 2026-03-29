import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { createTestApp } from '../helpers/test-app'
import { createVerifiedUser, loginAndGetCookies, uniqueEmail } from '../helpers/test-users'
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity'

describe('POST /api/auth/refresh (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('issues new token pair with rotation', async () => {
    const email = uniqueEmail('refresh-rot')
    await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, email)

    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))!

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie])

    expect(res.status).toBe(200)

    const newCookies = res.headers['set-cookie'] as unknown as string[]
    expect(newCookies.find((c: string) => c.startsWith('access_token='))).toBeDefined()
    expect(newCookies.find((c: string) => c.startsWith('refresh_token='))).toBeDefined()
  })

  it('revokes entire family on replay attack (reusing old token)', async () => {
    const email = uniqueEmail('refresh-replay')
    const { email: createdEmail } = await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, createdEmail)

    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))!

    // First refresh — valid
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie])

    // Second refresh with SAME token — replay attack
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie])

    expect(res.status).toBe(401)
    expect(res.body.message).toContain('reuse detected')

    // Verify all tokens for this user are revoked
    const ds = app.get(DataSource)
    const user = await ds.query('SELECT id FROM users WHERE email = $1', [createdEmail])
    const tokens = await ds.getRepository(RefreshToken).find({
      where: { userId: user[0].id },
    })
    const activeTokens = tokens.filter((t) => !t.revoked)
    expect(activeTokens).toHaveLength(0)
  })

  it('returns generic message when no refresh cookie present', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/refresh')

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('No refresh token')
  })
})
