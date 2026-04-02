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
  return {
    clientId,
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    currency: 'USD',
    description: 'Development services January 2026',
    lineItems: [
      { description: 'Development work', quantity: 160, unitPrice: 50, sortOrder: 0 },
    ],
    extras: [],
    ...overrides,
  }
}

async function authedRequest(app: INestApplication, email: string) {
  const { cookies } = await loginAndGetCookies(app, email)
  return {
    cookies,
    post: (url: string) => request(app.getHttpServer()).post(url).set('Cookie', cookies),
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookies),
    put: (url: string) => request(app.getHttpServer()).put(url).set('Cookie', cookies),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set('Cookie', cookies),
    delete: (url: string) => request(app.getHttpServer()).delete(url).set('Cookie', cookies),
  }
}

async function setupUserWithCompanyAndClient(app: INestApplication, tag: string) {
  const email = uniqueEmail(tag)
  await createVerifiedUser(app, email)
  const api = await authedRequest(app, email)

  await createCompany(app, api.cookies, validCompanyData({ invoicePrefix: 'TST' }))

  const clientRes = await api.post('/api/clients').send(validClient())
  const clientId = clientRes.body.id

  return { api, email, clientId }
}

describe('Invoices API (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/invoices', () => {
    it('201 creates invoice with auto-generated number', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-create')

      const res = await api.post('/api/invoices').send(validInvoice(clientId))

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.invoiceNumber).toBe('TST-0001')
      expect(res.body.status).toBe('draft')
      expect(res.body.subtotal).toBe(8000)
      expect(res.body.extrasTotal).toBe(0)
      expect(res.body.total).toBe(8000)
      expect(res.body.lineItems).toHaveLength(1)
    })

    it('201 creates invoice with extras and computes totals', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-extras')

      const res = await api.post('/api/invoices').send(
        validInvoice(clientId, {
          lineItems: [
            { description: 'Dev', quantity: 100, unitPrice: 50, sortOrder: 0 },
            { description: 'QA', quantity: 20, unitPrice: 40, sortOrder: 1 },
          ],
          extras: [{ description: 'Bonus', amount: 500, sortOrder: 0 }],
        }),
      )

      expect(res.status).toBe(201)
      expect(res.body.subtotal).toBe(5800)
      expect(res.body.extrasTotal).toBe(500)
      expect(res.body.total).toBe(6300)
      expect(res.body.lineItems).toHaveLength(2)
      expect(res.body.extraItems).toHaveLength(1)
    })

    it('400 without company setup', async () => {
      const email = uniqueEmail('inv-nocomp')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const clientRes = await api.post('/api/clients').send(validClient())

      const res = await api.post('/api/invoices').send(validInvoice(clientRes.body.id))

      expect(res.status).toBe(400)
    })

    it('400 for missing fields', async () => {
      const { api } = await setupUserWithCompanyAndClient(app, 'inv-miss')

      const res = await api.post('/api/invoices').send({})

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/invoices', () => {
    it('returns paginated list', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-list')

      await api.post('/api/invoices').send(validInvoice(clientId))
      await api.post('/api/invoices').send(validInvoice(clientId, { description: 'February' }))

      const res = await api.get('/api/invoices?page=1&limit=10')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.total).toBe(2)
    })

    it('filters by status', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-filt')

      const inv = await api.post('/api/invoices').send(validInvoice(clientId))
      await api.patch(`/api/invoices/${inv.body.id}/status`).send({ status: 'sent' })

      const res = await api.get('/api/invoices?status=sent')

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.every((i: { status: string }) => i.status === 'sent')).toBe(true)
    })
  })

  describe('GET /api/invoices/:id', () => {
    it('returns invoice detail', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-detail')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api.get(`/api/invoices/${created.body.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(created.body.id)
      expect(res.body.client).toBeDefined()
      expect(res.body.lineItems).toHaveLength(1)
    })

    it('404 for other user', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-iso1')
      const created = await api.post('/api/invoices').send(validInvoice(clientId))

      const otherEmail = uniqueEmail('inv-iso2')
      await createVerifiedUser(app, otherEmail)
      const otherApi = await authedRequest(app, otherEmail)

      const res = await otherApi.get(`/api/invoices/${created.body.id}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/invoices/:id', () => {
    it('updates draft invoice', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-upd')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api.put(`/api/invoices/${created.body.id}`).send(
        validInvoice(clientId, {
          description: 'Updated description',
          lineItems: [
            { description: 'Updated work', quantity: 200, unitPrice: 60, sortOrder: 0 },
          ],
        }),
      )

      expect(res.status).toBe(200)
      expect(res.body.description).toBe('Updated description')
      expect(res.body.subtotal).toBe(12000)
    })

    it('409 for non-draft invoice', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-upd409')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))
      await api.patch(`/api/invoices/${created.body.id}/status`).send({ status: 'sent' })

      const res = await api.put(`/api/invoices/${created.body.id}`).send(validInvoice(clientId))

      expect(res.status).toBe(409)
    })
  })

  describe('PATCH /api/invoices/:id/status', () => {
    it('transitions draft → sent', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-send')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api
        .patch(`/api/invoices/${created.body.id}/status`)
        .send({ status: 'sent' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('sent')
      expect(res.body.sentAt).toBeDefined()
    })

    it('transitions sent → paid', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-pay')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))
      await api.patch(`/api/invoices/${created.body.id}/status`).send({ status: 'sent' })

      const res = await api
        .patch(`/api/invoices/${created.body.id}/status`)
        .send({ status: 'paid' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('paid')
      expect(res.body.paidAt).toBeDefined()
    })

    it('409 for invalid transition paid → sent', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-badtrans')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))
      await api.patch(`/api/invoices/${created.body.id}/status`).send({ status: 'sent' })
      await api.patch(`/api/invoices/${created.body.id}/status`).send({ status: 'paid' })

      const res = await api
        .patch(`/api/invoices/${created.body.id}/status`)
        .send({ status: 'sent' })

      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/invoices/:id/pdf', () => {
    it('returns PDF content', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-pdf')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api.get(`/api/invoices/${created.body.id}/pdf`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('application/pdf')
    })

    it('returns Content-Type: application/pdf for modern template invoice', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-pdf-modern')

      const created = await api
        .post('/api/invoices')
        .send(validInvoice(clientId, { template: 'modern' }))

      const res = await api.get(`/api/invoices/${created.body.id}/pdf`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('application/pdf')
    })
  })

  describe('POST /api/invoices — template field', () => {
    it('persists template field when specified as modern', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-tmpl-modern')

      const res = await api
        .post('/api/invoices')
        .send(validInvoice(clientId, { template: 'modern' }))

      expect(res.status).toBe(201)
      expect(res.body.template).toBe('modern')
    })

    it('defaults to classic when template is omitted', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-tmpl-default')

      const res = await api.post('/api/invoices').send(validInvoice(clientId))

      expect(res.status).toBe(201)
      expect(res.body.template).toBe('classic')
    })
  })

  describe('POST /api/invoices/:id/duplicate', () => {
    it('201 creates new draft from existing', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-dup')

      const created = await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api.post(`/api/invoices/${created.body.id}/duplicate`)

      expect(res.status).toBe(201)
      expect(res.body.id).not.toBe(created.body.id)
      expect(res.body.invoiceNumber).not.toBe(created.body.invoiceNumber)
      expect(res.body.status).toBe('draft')
      expect(res.body.lineItems).toHaveLength(1)
    })
  })

  describe('GET /api/invoices/by-client/:clientId', () => {
    it('returns invoices for a client', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-bycli')

      await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api.get(`/api/invoices/by-client/${clientId}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })
  })

  describe('Client delete protection', () => {
    it('409 when client has invoices', async () => {
      const { api, clientId } = await setupUserWithCompanyAndClient(app, 'inv-delprot')

      await api.post('/api/invoices').send(validInvoice(clientId))

      const res = await api.delete(`/api/clients/${clientId}`)

      expect(res.status).toBe(409)
    })

    it('204 when client has no invoices', async () => {
      const email = uniqueEmail('inv-delok')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const clientRes = await api.post('/api/clients').send(validClient())

      const res = await api.delete(`/api/clients/${clientRes.body.id}`)

      expect(res.status).toBe(204)
    })
  })
})
