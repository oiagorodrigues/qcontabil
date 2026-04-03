import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from '../helpers/test-app'
import { createVerifiedUser, loginAndGetCookies, uniqueEmail } from '../helpers/test-users'
import { createCompany, validCompanyData } from '../helpers/test-companies'

function validClient(overrides: Record<string, unknown> = {}) {
  return {
    fantasyName: 'Acme Corp',
    company: 'Acme Inc.',
    country: 'United States',
    countryCode: 'US',
    email: 'billing@acme.com',
    currency: 'USD',
    status: 'active',
    contacts: [{ name: 'John Doe', email: 'john@acme.com', isPrimary: true }],
    ...overrides,
  }
}

function validInvoice(clientId: string, overrides: Record<string, unknown> = {}) {
  const today = new Date().toISOString().split('T')[0]
  return {
    clientId,
    issueDate: today,
    dueDate: today,
    currency: 'USD',
    description: 'Development services',
    lineItems: [{ description: 'Dev work', quantity: 10, unitPrice: 100, sortOrder: 0 }],
    extras: [],
    ...overrides,
  }
}

async function authedRequest(app: INestApplication, email: string) {
  const { cookies } = await loginAndGetCookies(app, email)
  return {
    cookies,
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookies),
    post: (url: string) => request(app.getHttpServer()).post(url).set('Cookie', cookies),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set('Cookie', cookies),
  }
}

describe('Dashboard Integration', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Authentication', () => {
    it('GET /api/dashboard/summary returns 401 without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/dashboard/summary')
      expect(res.status).toBe(401)
    })

    it('GET /api/dashboard/revenue-chart returns 401 without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/dashboard/revenue-chart')
      expect(res.status).toBe(401)
    })

    it('GET /api/dashboard/top-clients returns 401 without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/dashboard/top-clients')
      expect(res.status).toBe(401)
    })
  })

  describe('Empty state', () => {
    it('GET /api/dashboard/summary returns 200 with zero values when no invoices', async () => {
      const email = uniqueEmail('dash-empty')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const res = await api.get('/api/dashboard/summary?period=month')

      expect(res.status).toBe(200)
      expect(res.body.totalBilled.total).toBe(0)
      expect(res.body.totalPending.total).toBe(0)
      expect(res.body.totalReceived.total).toBe(0)
      expect(res.body.recentInvoices).toEqual([])
      expect(res.body.availableCurrencies).toEqual([])
    })

    it('GET /api/dashboard/revenue-chart returns empty data array', async () => {
      const email = uniqueEmail('dash-chart-empty')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const res = await api.get('/api/dashboard/revenue-chart?period=month')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('GET /api/dashboard/top-clients returns empty clients array', async () => {
      const email = uniqueEmail('dash-top-empty')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const res = await api.get('/api/dashboard/top-clients?period=month')

      expect(res.status).toBe(200)
      expect(res.body.clients).toEqual([])
    })
  })

  describe('With data', () => {
    let api: Awaited<ReturnType<typeof authedRequest>>
    let clientId: string

    beforeAll(async () => {
      const email = uniqueEmail('dash-data')
      await createVerifiedUser(app, email)
      api = await authedRequest(app, email)
      await createCompany(app, api.cookies, validCompanyData({ invoicePrefix: 'DSH' }))

      const clientRes = await api.post('/api/clients').send(validClient())
      clientId = clientRes.body.id

      // Create a paid invoice
      const invRes = await api.post('/api/invoices').send(validInvoice(clientId))
      await api.patch(`/api/invoices/${invRes.body.id}/status`).send({ status: 'sent' })
      await api.patch(`/api/invoices/${invRes.body.id}/status`).send({ status: 'paid' })
    })

    it('summary shows correct totals after paid invoice', async () => {
      const res = await api.get('/api/dashboard/summary?period=month')

      expect(res.status).toBe(200)
      expect(res.body.totalReceived.total).toBe(1000)
      expect(res.body.totalBilled.total).toBe(1000)
      expect(res.body.invoiceCount.paid).toBe(1)
      expect(res.body.recentInvoices).toHaveLength(1)
      expect(res.body.availableCurrencies).toContain('USD')
    })

    it('summary filters by currency', async () => {
      const res = await api.get('/api/dashboard/summary?period=month&currency=EUR')

      expect(res.status).toBe(200)
      expect(res.body.totalBilled.total).toBe(0)
    })

    it('revenue-chart returns data point for current month', async () => {
      const res = await api.get('/api/dashboard/revenue-chart?period=month')

      expect(res.status).toBe(200)
      const total = res.body.data.reduce((sum: number, d: { total: number }) => sum + d.total, 0)
      expect(total).toBe(1000)
    })

    it('top-clients returns Acme Corp', async () => {
      const res = await api.get('/api/dashboard/top-clients?period=month')

      expect(res.status).toBe(200)
      expect(res.body.clients).toHaveLength(1)
      expect(res.body.clients[0].clientName).toBe('Acme Corp')
      expect(res.body.clients[0].total).toBe(1000)
      expect(res.body.clients[0].percentage).toBe(100)
    })
  })

  describe('Period validation', () => {
    it('rejects invalid period value', async () => {
      const email = uniqueEmail('dash-valid')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const res = await api.get('/api/dashboard/summary?period=invalid')

      expect(res.status).toBe(400)
    })
  })
})
