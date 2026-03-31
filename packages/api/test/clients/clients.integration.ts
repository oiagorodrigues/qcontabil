import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createTestApp } from '../helpers/test-app'
import { createVerifiedUser, loginAndGetCookies, uniqueEmail } from '../helpers/test-users'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function authedRequest(app: INestApplication, email: string) {
  const { cookies } = await loginAndGetCookies(app, email)
  return {
    post: (url: string) => request(app.getHttpServer()).post(url).set('Cookie', cookies),
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookies),
    put: (url: string) => request(app.getHttpServer()).put(url).set('Cookie', cookies),
    delete: (url: string) => request(app.getHttpServer()).delete(url).set('Cookie', cookies),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Clients API (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // -----------------------------------------------------------------------
  // POST /api/clients
  // -----------------------------------------------------------------------
  describe('POST /api/clients', () => {
    it('201 creates client with contacts', async () => {
      const email = uniqueEmail('cli-create')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const payload = validClient({
        contacts: [
          { name: 'Primary', email: 'primary@acme.com', isPrimary: true },
          { name: 'Secondary', email: 'sec@acme.com', isPrimary: false, role: 'CTO' },
        ],
      })

      const res = await api.post('/api/clients').send(payload)

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.fantasyName).toBe('Acme Corp')
      expect(res.body.company).toBe('Acme Inc.')
      expect(res.body.contacts).toHaveLength(2)

      const primary = res.body.contacts.find((c: { isPrimary: boolean }) => c.isPrimary)
      expect(primary).toBeDefined()
      expect(primary.name).toBe('Primary')
    })

    it('400 for missing required fields', async () => {
      const email = uniqueEmail('cli-miss')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const res = await api.post('/api/clients').send({})

      expect(res.status).toBe(400)
    })

    it('400 for no primary contact', async () => {
      const email = uniqueEmail('cli-nopri')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const payload = validClient({
        contacts: [{ name: 'Non-primary', email: 'np@acme.com', isPrimary: false }],
      })

      const res = await api.post('/api/clients').send(payload)

      expect(res.status).toBe(400)
    })

    it('400 for multiple primary contacts', async () => {
      const email = uniqueEmail('cli-multi')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const payload = validClient({
        contacts: [
          { name: 'A', email: 'a@acme.com', isPrimary: true },
          { name: 'B', email: 'b@acme.com', isPrimary: true },
        ],
      })

      const res = await api.post('/api/clients').send(payload)

      expect(res.status).toBe(400)
    })

    it('401 without auth cookies', async () => {
      const res = await request(app.getHttpServer()).post('/api/clients').send(validClient())

      expect(res.status).toBe(401)
    })
  })

  // -----------------------------------------------------------------------
  // GET /api/clients
  // -----------------------------------------------------------------------
  describe('GET /api/clients', () => {
    it('200 returns paginated list', async () => {
      const email = uniqueEmail('cli-list')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      // Seed 3 clients
      for (let i = 0; i < 3; i++) {
        await api.post('/api/clients').send(
          validClient({
            fantasyName: `Client ${i}`,
            company: `Company ${i}`,
            email: `c${i}@example.com`,
          }),
        )
      }

      const res = await api.get('/api/clients?page=1&limit=2')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.total).toBe(3)
      expect(res.body.page).toBe(1)
      expect(res.body.limit).toBe(2)
    })

    it('filters by search (fantasyName)', async () => {
      const email = uniqueEmail('cli-search')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      await api
        .post('/api/clients')
        .send(validClient({ fantasyName: 'UniqueAlpha', company: 'Co A', email: 'a@x.com' }))
      await api
        .post('/api/clients')
        .send(validClient({ fantasyName: 'UniqueBeta', company: 'Co B', email: 'b@x.com' }))

      const res = await api.get('/api/clients?search=UniqueAlpha')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].fantasyName).toBe('UniqueAlpha')
    })

    it('filters by status', async () => {
      const email = uniqueEmail('cli-status')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      await api.post('/api/clients').send(
        validClient({
          fantasyName: 'Active',
          company: 'Active Co',
          email: 'act@x.com',
          status: 'active',
        }),
      )
      await api.post('/api/clients').send(
        validClient({
          fantasyName: 'Inactive',
          company: 'Inactive Co',
          email: 'inact@x.com',
          status: 'inactive',
        }),
      )

      const res = await api.get('/api/clients?status=inactive')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].fantasyName).toBe('Inactive')
    })

    it('sorts by fantasyName descending', async () => {
      const email = uniqueEmail('cli-sort')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      await api
        .post('/api/clients')
        .send(validClient({ fantasyName: 'Aardvark', company: 'A Co', email: 'a@s.com' }))
      await api
        .post('/api/clients')
        .send(validClient({ fantasyName: 'Zebra', company: 'Z Co', email: 'z@s.com' }))

      const res = await api.get('/api/clients?sort=fantasyName:desc')

      expect(res.status).toBe(200)
      expect(res.body.data[0].fantasyName).toBe('Zebra')
      expect(res.body.data[1].fantasyName).toBe('Aardvark')
    })

    it('isolates clients between users', async () => {
      const emailA = uniqueEmail('cli-iso-a')
      const emailB = uniqueEmail('cli-iso-b')
      await createVerifiedUser(app, emailA)
      await createVerifiedUser(app, emailB)

      const apiA = await authedRequest(app, emailA)
      const apiB = await authedRequest(app, emailB)

      await apiA
        .post('/api/clients')
        .send(validClient({ fantasyName: 'UserA-Client', company: 'A Co', email: 'ua@x.com' }))
      await apiB
        .post('/api/clients')
        .send(validClient({ fantasyName: 'UserB-Client', company: 'B Co', email: 'ub@x.com' }))

      const resA = await apiA.get('/api/clients')
      const resB = await apiB.get('/api/clients')

      const namesA = resA.body.data.map((c: { fantasyName: string }) => c.fantasyName)
      const namesB = resB.body.data.map((c: { fantasyName: string }) => c.fantasyName)

      expect(namesA).toContain('UserA-Client')
      expect(namesA).not.toContain('UserB-Client')
      expect(namesB).toContain('UserB-Client')
      expect(namesB).not.toContain('UserA-Client')
    })
  })

  // -----------------------------------------------------------------------
  // GET /api/clients/:id
  // -----------------------------------------------------------------------
  describe('GET /api/clients/:id', () => {
    it('200 returns client with contacts', async () => {
      const email = uniqueEmail('cli-get')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const created = await api.post('/api/clients').send(validClient())
      const id = created.body.id

      const res = await api.get(`/api/clients/${id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(id)
      expect(res.body.fantasyName).toBe('Acme Corp')
      expect(res.body.contacts).toHaveLength(1)
      expect(res.body.contacts[0].isPrimary).toBe(true)
    })

    it('404 for non-existent id', async () => {
      const email = uniqueEmail('cli-404')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const res = await api.get('/api/clients/00000000-0000-0000-0000-000000000000')

      expect(res.status).toBe(404)
    })

    it('404 for other user client (not 403)', async () => {
      const emailOwner = uniqueEmail('cli-own')
      const emailOther = uniqueEmail('cli-oth')
      await createVerifiedUser(app, emailOwner)
      await createVerifiedUser(app, emailOther)

      const apiOwner = await authedRequest(app, emailOwner)
      const apiOther = await authedRequest(app, emailOther)

      const created = await apiOwner.post('/api/clients').send(validClient())
      const id = created.body.id

      const res = await apiOther.get(`/api/clients/${id}`)

      expect(res.status).toBe(404)
    })
  })

  // -----------------------------------------------------------------------
  // PUT /api/clients/:id
  // -----------------------------------------------------------------------
  describe('PUT /api/clients/:id', () => {
    it('200 updates client and contacts', async () => {
      const email = uniqueEmail('cli-upd')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const created = await api.post('/api/clients').send(validClient())
      const id = created.body.id

      const updated = validClient({
        fantasyName: 'Updated Corp',
        company: 'Updated Inc.',
        email: 'updated@acme.com',
        contacts: [{ name: 'New Primary', email: 'newpri@acme.com', isPrimary: true }],
      })

      const res = await api.put(`/api/clients/${id}`).send(updated)

      expect(res.status).toBe(200)
      expect(res.body.fantasyName).toBe('Updated Corp')
      expect(res.body.company).toBe('Updated Inc.')
      expect(res.body.contacts).toHaveLength(1)
      expect(res.body.contacts[0].name).toBe('New Primary')
    })

    it('404 for other user client', async () => {
      const emailOwner = uniqueEmail('cli-updown')
      const emailOther = uniqueEmail('cli-updoth')
      await createVerifiedUser(app, emailOwner)
      await createVerifiedUser(app, emailOther)

      const apiOwner = await authedRequest(app, emailOwner)
      const apiOther = await authedRequest(app, emailOther)

      const created = await apiOwner.post('/api/clients').send(validClient())
      const id = created.body.id

      const res = await apiOther
        .put(`/api/clients/${id}`)
        .send(validClient({ fantasyName: 'Hacked' }))

      expect(res.status).toBe(404)
    })
  })

  // -----------------------------------------------------------------------
  // DELETE /api/clients/:id
  // -----------------------------------------------------------------------
  describe('DELETE /api/clients/:id', () => {
    it('204 deletes client and cascades contacts', async () => {
      const email = uniqueEmail('cli-del')
      await createVerifiedUser(app, email)
      const api = await authedRequest(app, email)

      const created = await api.post('/api/clients').send(
        validClient({
          contacts: [
            { name: 'Contact1', email: 'c1@x.com', isPrimary: true },
            { name: 'Contact2', email: 'c2@x.com', isPrimary: false },
          ],
        }),
      )
      const id = created.body.id

      const res = await api.delete(`/api/clients/${id}`)
      expect(res.status).toBe(204)

      // Verify client is gone
      const getRes = await api.get(`/api/clients/${id}`)
      expect(getRes.status).toBe(404)
    })

    it('404 for other user client', async () => {
      const emailOwner = uniqueEmail('cli-delown')
      const emailOther = uniqueEmail('cli-deloth')
      await createVerifiedUser(app, emailOwner)
      await createVerifiedUser(app, emailOther)

      const apiOwner = await authedRequest(app, emailOwner)
      const apiOther = await authedRequest(app, emailOther)

      const created = await apiOwner.post('/api/clients').send(validClient())
      const id = created.body.id

      const res = await apiOther.delete(`/api/clients/${id}`)
      expect(res.status).toBe(404)

      // Verify client still exists for owner
      const getRes = await apiOwner.get(`/api/clients/${id}`)
      expect(getRes.status).toBe(200)
    })
  })
})
