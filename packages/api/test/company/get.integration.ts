import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from '../helpers/test-app'
import { createVerifiedUser, loginAndGetCookies } from '../helpers/test-users'
import { createCompany } from '../helpers/test-companies'

describe('GET /api/companies/me (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns company when it exists — 200', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)
    await createCompany(app, cookies)

    const res = await request(app.getHttpServer()).get('/api/companies/me').set('Cookie', cookies)

    expect(res.status).toBe(200)
    expect(res.body.legalName).toBe('Test Tecnologia LTDA')
    expect(res.body.cnpj).toMatch(/^\d{14}$/)
    expect(res.body.id).toBeDefined()
  })

  it('returns 404 when no company — 404', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await request(app.getHttpServer()).get('/api/companies/me').set('Cookie', cookies)

    expect(res.status).toBe(404)
  })

  it('rejects unauthenticated request — 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/companies/me')

    expect(res.status).toBe(401)
  })
})
