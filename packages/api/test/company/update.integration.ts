import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from '../helpers/test-app'
import { createVerifiedUser, loginAndGetCookies } from '../helpers/test-users'
import { createCompany, validCompanyData } from '../helpers/test-companies'

describe('PUT /api/companies/me (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('updates company with valid data — 200', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)
    await createCompany(app, cookies)

    const res = await request(app.getHttpServer())
      .put('/api/companies/me')
      .set('Cookie', cookies)
      .send(validCompanyData({ legalName: 'Updated LTDA' }))

    expect(res.status).toBe(200)
    expect(res.body.legalName).toBe('Updated LTDA')
  })

  it('rejects invalid CNPJ on update — 400', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)
    await createCompany(app, cookies)

    const res = await request(app.getHttpServer())
      .put('/api/companies/me')
      .set('Cookie', cookies)
      .send(validCompanyData({ cnpj: '00000000000000' }))

    expect(res.status).toBe(400)
  })

  it('returns 404 when no company to update', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await request(app.getHttpServer())
      .put('/api/companies/me')
      .set('Cookie', cookies)
      .send(validCompanyData())

    expect(res.status).toBe(404)
  })

  it('rejects unauthenticated request — 401', async () => {
    const res = await request(app.getHttpServer()).put('/api/companies/me').send(validCompanyData())

    expect(res.status).toBe(401)
  })
})
