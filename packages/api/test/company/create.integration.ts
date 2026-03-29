import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from '../helpers/test-app'
import { createVerifiedUser, loginAndGetCookies } from '../helpers/test-users'
import { createCompany, validCompanyData, randomCnpj } from '../helpers/test-companies'

describe('POST /api/companies (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates company with valid data — 201', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await createCompany(app, cookies)

    expect(res.status).toBe(201)
    expect(res.body.legalName).toBe('Test Tecnologia LTDA')
    expect(res.body.cnpj).toMatch(/^\d{14}$/)
    expect(res.body.id).toBeDefined()
    expect(res.body.createdAt).toBeDefined()
  })

  it('rejects invalid CNPJ — 400', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await createCompany(app, cookies, { cnpj: '00000000000000' })

    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('rejects missing required fields — 400', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/companies')
      .set('Cookie', cookies)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('rejects second company for same user — 409', async () => {
    const { email } = await createVerifiedUser(app)
    const { cookies } = await loginAndGetCookies(app, email)

    await createCompany(app, cookies)
    const res = await createCompany(app, cookies)

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('ja possui')
  })

  it('rejects duplicate CNPJ from different user — 409', async () => {
    const cnpj = randomCnpj()

    const user1 = await createVerifiedUser(app)
    const { cookies: cookies1 } = await loginAndGetCookies(app, user1.email)
    await createCompany(app, cookies1, { cnpj })

    const user2 = await createVerifiedUser(app)
    const { cookies: cookies2 } = await loginAndGetCookies(app, user2.email)
    const res = await createCompany(app, cookies2, { cnpj })

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('CNPJ ja cadastrado')
  })

  it('rejects unauthenticated request — 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/companies').send(validCompanyData())

    expect(res.status).toBe(401)
  })
})
