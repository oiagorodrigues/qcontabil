import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import type { Repository, ObjectLiteral } from 'typeorm'
import { ClientsService } from './clients.service'
import type { Client } from './entities/client.entity'
import type { Contact } from './entities/contact.entity'
import type { CreateClientInput, UpdateClientInput, ListClientsQuery } from '@qcontabil/shared'

type MockRepo<T extends ObjectLiteral> = Pick<
  Repository<T>,
  'findOne' | 'findOneBy' | 'create' | 'save' | 'remove' | 'createQueryBuilder' | 'delete' | 'findOneByOrFail' | 'update'
>

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> & {
  findOne: ReturnType<typeof vi.fn>
  findOneBy: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  createQueryBuilder: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  findOneByOrFail: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
} {
  return {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn((data: Partial<T>) => data),
    save: vi.fn().mockImplementation((entity: T) => Promise.resolve(entity)),
    remove: vi.fn().mockImplementation((entity: T) => Promise.resolve(entity)),
    createQueryBuilder: vi.fn(),
    delete: vi.fn(),
    findOneByOrFail: vi.fn(),
    update: vi.fn(),
  } as MockRepo<T> & {
    findOne: ReturnType<typeof vi.fn>
    findOneBy: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    createQueryBuilder: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    findOneByOrFail: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

const NOW = new Date('2026-01-15T10:00:00.000Z')

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    fantasyName: 'Acme Corp',
    company: 'Acme Inc',
    country: 'United States',
    countryCode: 'US',
    email: 'billing@acme.com',
    phone: '+1-555-0100',
    website: 'https://acme.com',
    address: '123 Main St',
    notes: 'Good client',
    currency: 'USD',
    status: 'active',
    userId: 'user-1',
    contacts: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Client
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    name: 'John Doe',
    email: 'john@acme.com',
    phone: '+1-555-0101',
    role: 'CTO',
    isPrimary: true,
    clientId: 'client-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Contact
}

const createDto: CreateClientInput = {
  fantasyName: 'Acme Corp',
  company: 'Acme Inc',
  country: 'United States',
  countryCode: 'US',
  email: 'billing@acme.com',
  phone: '+1-555-0100',
  website: 'https://acme.com',
  address: '123 Main St',
  notes: 'Good client',
  currency: 'USD',
  status: 'active',
  contacts: [
    { name: 'John Doe', email: 'john@acme.com', phone: '+1-555-0101', role: 'CTO', isPrimary: true },
    { name: 'Jane Doe', email: 'jane@acme.com', phone: null, role: null, isPrimary: false },
  ],
}

describe('ClientsService', () => {
  let service: ClientsService
  let clientRepo: ReturnType<typeof createMockRepo<Client>>
  let contactRepo: ReturnType<typeof createMockRepo<Contact>>
  let mockDataSource: { transaction: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    clientRepo = createMockRepo<Client>()
    contactRepo = createMockRepo<Contact>()

    mockDataSource = {
      transaction: vi.fn().mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          create: vi.fn().mockImplementation((_Entity: unknown, data: Record<string, unknown>) => ({ id: 'new-id', ...data })),
          save: vi.fn().mockImplementation((_Entity: unknown, data: unknown) => {
            if (Array.isArray(data)) {
              return Promise.resolve(data.map((d, i) => ({ id: `contact-${i + 1}`, ...d })))
            }
            return Promise.resolve({ id: 'client-1', createdAt: NOW, updatedAt: NOW, ...data as Record<string, unknown> })
          }),
          update: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          findOneByOrFail: vi.fn().mockResolvedValue(makeClient()),
        }
        return cb(manager)
      }),
    }

    service = new ClientsService(
      clientRepo as unknown as Repository<Client>,
      contactRepo as unknown as Repository<Contact>,
      mockDataSource as unknown as import('typeorm').DataSource,
    )
  })

  // --- create ---

  describe('create', () => {
    it('creates client and contacts in a transaction', async () => {
      const result = await service.create('user-1', createDto)

      expect(mockDataSource.transaction).toHaveBeenCalledOnce()
      expect(result.id).toBeDefined()
      expect(result.fantasyName).toBe('Acme Corp')
      expect(result.contacts).toHaveLength(2)
      expect(result.contacts[0].name).toBe('John Doe')
    })

    it('passes userId to the created client entity', async () => {
      let capturedManager: Record<string, ReturnType<typeof vi.fn>> | undefined
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => Promise<unknown>) => {
        capturedManager = {
          create: vi.fn().mockImplementation((_E: unknown, data: Record<string, unknown>) => ({ id: 'c-1', createdAt: NOW, updatedAt: NOW, ...data })),
          save: vi.fn().mockImplementation((_E: unknown, data: unknown) => {
            if (Array.isArray(data)) return Promise.resolve(data.map((d, i) => ({ id: `ct-${i}`, ...d })))
            return Promise.resolve(data)
          }),
        }
        return cb(capturedManager)
      })

      await service.create('user-1', createDto)

      expect(capturedManager!.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'user-1' }),
      )
    })
  })

  // --- findAll ---

  describe('findAll', () => {
    function setupQueryBuilder(clients: Client[], total: number) {
      const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(total),
        getMany: vi.fn().mockResolvedValue(clients),
      }
      clientRepo.createQueryBuilder.mockReturnValue(qb)
      return qb
    }

    const baseQuery: ListClientsQuery = { page: 1, limit: 20 }

    it('returns paginated data', async () => {
      const client = makeClient({ contacts: [makeContact()] })
      const qb = setupQueryBuilder([client], 1)

      const result = await service.findAll('user-1', baseQuery)

      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].fantasyName).toBe('Acme Corp')
      expect(qb.skip).toHaveBeenCalledWith(0)
      expect(qb.take).toHaveBeenCalledWith(20)
    })

    it('applies search filter on fantasyName and company', async () => {
      const qb = setupQueryBuilder([], 0)

      await service.findAll('user-1', { ...baseQuery, search: 'acme' })

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(client.fantasyName ILIKE :search OR client.company ILIKE :search)',
        { search: '%acme%' },
      )
    })

    it('applies status filter', async () => {
      const qb = setupQueryBuilder([], 0)

      await service.findAll('user-1', { ...baseQuery, status: 'active' })

      expect(qb.andWhere).toHaveBeenCalledWith('client.status = :status', { status: 'active' })
    })

    it('applies country filter', async () => {
      const qb = setupQueryBuilder([], 0)

      await service.findAll('user-1', { ...baseQuery, country: 'United States' })

      expect(qb.andWhere).toHaveBeenCalledWith('client.country = :country', { country: 'United States' })
    })

    it('applies custom sort', async () => {
      const qb = setupQueryBuilder([], 0)

      await service.findAll('user-1', { ...baseQuery, sort: 'company:desc' })

      expect(qb.orderBy).toHaveBeenCalledWith('client.company', 'DESC')
    })

    it('defaults to fantasyName ASC sort', async () => {
      const qb = setupQueryBuilder([], 0)

      await service.findAll('user-1', baseQuery)

      expect(qb.orderBy).toHaveBeenCalledWith('client.fantasyName', 'ASC')
    })

    it('filters by userId (user isolation)', async () => {
      const qb = setupQueryBuilder([], 0)

      await service.findAll('user-1', baseQuery)

      expect(qb.where).toHaveBeenCalledWith('client.userId = :userId', { userId: 'user-1' })
    })

    it('extracts primary contact for summary', async () => {
      const primary = makeContact({ isPrimary: true, name: 'Primary', email: 'primary@acme.com' })
      const client = makeClient({ contacts: [primary] })
      setupQueryBuilder([client], 1)

      const result = await service.findAll('user-1', baseQuery)

      expect(result.data[0].primaryContactName).toBe('Primary')
      expect(result.data[0].primaryContactEmail).toBe('primary@acme.com')
    })
  })

  // --- findOne ---

  describe('findOne', () => {
    it('returns client detail with contacts', async () => {
      const contacts = [makeContact()]
      const client = makeClient({ contacts })
      clientRepo.findOne.mockResolvedValue(client)

      const result = await service.findOne('user-1', 'client-1')

      expect(clientRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'client-1', userId: 'user-1' },
        relations: ['contacts'],
      })
      expect(result.id).toBe('client-1')
      expect(result.contacts).toHaveLength(1)
      expect(result.contacts[0].name).toBe('John Doe')
    })

    it('throws NotFoundException when client does not exist', async () => {
      clientRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('user-1', 'nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException for wrong user (404 not 403)', async () => {
      clientRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('other-user', 'client-1')).rejects.toThrow(NotFoundException)
    })
  })

  // --- update ---

  describe('update', () => {
    const updateDto: UpdateClientInput = {
      ...createDto,
      fantasyName: 'Acme Updated',
    }

    it('updates client, deletes old contacts, creates new contacts in a transaction', async () => {
      clientRepo.findOneBy.mockResolvedValue(makeClient())
      let capturedManager: Record<string, ReturnType<typeof vi.fn>> | undefined
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => Promise<unknown>) => {
        capturedManager = {
          update: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          create: vi.fn().mockImplementation((_E: unknown, data: Record<string, unknown>) => ({ id: 'new-id', ...data })),
          save: vi.fn().mockImplementation((_E: unknown, data: unknown) => {
            if (Array.isArray(data)) return Promise.resolve(data.map((d, i) => ({ id: `ct-${i}`, ...d })))
            return Promise.resolve(data)
          }),
          findOneByOrFail: vi.fn().mockResolvedValue(makeClient({ fantasyName: 'Acme Updated' })),
        }
        return cb(capturedManager)
      })

      const result = await service.update('user-1', 'client-1', updateDto)

      expect(clientRepo.findOneBy).toHaveBeenCalledWith({ id: 'client-1', userId: 'user-1' })
      expect(mockDataSource.transaction).toHaveBeenCalledOnce()
      expect(capturedManager!.update).toHaveBeenCalled()
      expect(capturedManager!.delete).toHaveBeenCalled()
      expect(result.fantasyName).toBe('Acme Updated')
      expect(result.contacts).toHaveLength(2)
    })

    it('throws NotFoundException for wrong user', async () => {
      clientRepo.findOneBy.mockResolvedValue(null)

      await expect(service.update('other-user', 'client-1', updateDto)).rejects.toThrow(NotFoundException)
    })
  })

  // --- remove ---

  describe('remove', () => {
    it('removes client successfully', async () => {
      const client = makeClient()
      clientRepo.findOneBy.mockResolvedValue(client)

      await service.remove('user-1', 'client-1')

      expect(clientRepo.findOneBy).toHaveBeenCalledWith({ id: 'client-1', userId: 'user-1' })
      expect(clientRepo.remove).toHaveBeenCalledWith(client)
    })

    it('throws NotFoundException for wrong user', async () => {
      clientRepo.findOneBy.mockResolvedValue(null)

      await expect(service.remove('other-user', 'client-1')).rejects.toThrow(NotFoundException)
    })
  })
})
