import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { createTestApp } from './helpers/test-app'
import { createVerifiedUser, registerUser, uniqueEmail, TEST_PASSWORD } from './helpers/test-users'
import { User } from '../entities/user.entity'

describe('POST /api/auth/login (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('sets httpOnly cookies on successful login', async () => {
    const email = uniqueEmail('login-cookie')
    await createVerifiedUser(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })

    expect(res.status).toBe(200)

    const cookies = res.headers['set-cookie'] as unknown as string[]
    expect(cookies).toBeDefined()

    const accessCookie = cookies.find((c: string) => c.startsWith('access_token='))
    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))

    expect(accessCookie).toBeDefined()
    expect(accessCookie).toContain('HttpOnly')

    expect(refreshCookie).toBeDefined()
    expect(refreshCookie).toContain('HttpOnly')
    expect(refreshCookie).toContain('Path=/api/auth/refresh')
  })

  it('returns user profile in response body', async () => {
    const email = uniqueEmail('login-profile')
    await createVerifiedUser(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })

    expect(res.body.user).toBeDefined()
    expect(res.body.user.email).toBe(email)
    expect(res.body.user.emailVerified).toBe(true)
  })

  it('returns 401 for wrong password (generic message)', async () => {
    const email = uniqueEmail('login-wrong')
    await createVerifiedUser(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword123!' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password')
  })

  it('returns 401 for nonexistent email (generic, no enumeration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: uniqueEmail('noexist'), password: 'AnyPass123!' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password')
  })

  it('returns 403 for unverified email', async () => {
    const email = uniqueEmail('login-unverif')
    await registerUser(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })

    expect(res.status).toBe(403)
    expect(res.body.message).toContain('verify your email')
  })

  it('locks account after 10 failed attempts', async () => {
    const email = uniqueEmail('login-lock')
    await createVerifiedUser(app, email)

    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: `Wrong!${i}abcdefg` })
    }

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain('locked')

    const ds = app.get(DataSource)
    const user = await ds.getRepository(User).findOne({ where: { email } })
    expect(user!.lockedUntil).toBeDefined()
    expect(user!.lockedUntil!.getTime()).toBeGreaterThan(Date.now())
  })
})
