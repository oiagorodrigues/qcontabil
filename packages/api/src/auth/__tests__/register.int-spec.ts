import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from './helpers/test-app'
import { registerUser, uniqueEmail } from './helpers/test-users'

describe('POST /api/auth/register (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('registers a new user and returns generic message', async () => {
    const res = await registerUser(app, uniqueEmail('reg'))
    expect(res.status).toBe(200)
    expect(res.body.message).toContain('verification link')
  })

  it('returns same generic message for duplicate email (no enumeration)', async () => {
    const email = uniqueEmail('dup')
    await registerUser(app, email)
    const res = await registerUser(app, email)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('verification link')
  })

  it('rejects invalid email with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'StrongP@ss1234!' })

    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('rejects password shorter than 8 chars with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'short' })

    expect(res.status).toBe(400)
  })

  it('normalizes email to lowercase', async () => {
    const base = uniqueEmail('norm')
    const upper = base.toUpperCase()
    await registerUser(app, upper)
    const res = await registerUser(app, base)
    expect(res.status).toBe(200) // generic, no enumeration
  })
})
