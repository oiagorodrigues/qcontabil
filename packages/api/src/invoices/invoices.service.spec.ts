import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import type { Repository, ObjectLiteral, DataSource, EntityManager } from 'typeorm'
import { InvoicesService } from './invoices.service'
import type { Invoice } from './entities/invoice.entity'
import type { InvoiceLineItem } from './entities/invoice-line-item.entity'
import type { InvoiceExtra } from './entities/invoice-extra.entity'
import type { CompanyService } from '../company/company.service'
import type { CompanyResponse } from '@qcontabil/shared'

function createMockRepo<T extends ObjectLiteral>() {
  return {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    find: vi.fn(),
    create: vi.fn((data: Partial<T>) => data),
    save: vi.fn().mockImplementation((entity: T) => Promise.resolve({ id: 'new-id', ...entity })),
    remove: vi.fn(),
    createQueryBuilder: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    countBy: vi.fn(),
  } as unknown as Repository<T> & {
    findOne: ReturnType<typeof vi.fn>
    findOneBy: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    createQueryBuilder: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    countBy: ReturnType<typeof vi.fn>
  }
}

const NOW = new Date('2026-01-15T10:00:00.000Z')

const COMPANY: CompanyResponse = {
  id: 'company-1',
  legalName: 'My Company',
  cnpj: '12345678000100',
  taxRegime: 'MEI' as CompanyResponse['taxRegime'],
  email: 'me@company.com',
  phone: '11999999999',
  street: 'Rua A',
  streetNumber: '100',
  complement: null,
  zipCode: '01001000',
  city: 'Sao Paulo',
  state: 'SP' as CompanyResponse['state'],
  country: 'Brazil',
  bankBeneficiaryName: null,
  bankName: null,
  bankAccountType: null,
  bankAccountNumber: null,
  bankSwiftCode: null,
  invoicePrefix: 'INV',
  defaultTemplate: null,
  paymentProvider: null,
  hasPaymentProvider: false,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-0001',
    status: 'draft',
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    sentAt: null,
    paidAt: null,
    currency: 'USD',
    description: 'Dev services',
    notes: null,
    paymentInstructions: null,
    subtotal: 8000,
    extrasTotal: 500,
    total: 8500,
    template: 'classic' as Invoice['template'],
    clientId: 'client-1',
    userId: 'user-1',
    client: {
      fantasyName: 'Acme',
      company: 'Acme Inc',
      email: 'acme@test.com',
      address: null,
      country: 'US',
      countryCode: 'US',
    } as Invoice['client'],
    lineItems: [],
    extraItems: [],
    createdAt: NOW,
    updatedAt: NOW,
    user: {} as Invoice['user'],
    ...overrides,
  } as Invoice
}

describe('InvoicesService', () => {
  let service: InvoicesService
  let invoiceRepo: ReturnType<typeof createMockRepo<Invoice>>
  let lineItemRepo: ReturnType<typeof createMockRepo<InvoiceLineItem>>
  let extraRepo: ReturnType<typeof createMockRepo<InvoiceExtra>>
  let companyService: { findByUser: ReturnType<typeof vi.fn> }
  let mockManager: EntityManager

  beforeEach(() => {
    invoiceRepo = createMockRepo<Invoice>()
    lineItemRepo = createMockRepo<InvoiceLineItem>()
    extraRepo = createMockRepo<InvoiceExtra>()
    companyService = { findByUser: vi.fn() }

    mockManager = {
      create: vi.fn((_, data) => data),
      save: vi.fn().mockImplementation((_, entity) =>
        Promise.resolve(Array.isArray(entity) ? entity.map((e: Record<string, unknown>) => ({ id: 'new-id', ...e })) : { id: 'new-id', ...entity }),
      ),
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findOneByOrFail: vi.fn(),
    } as unknown as EntityManager

    const mockDataSource = {
      transaction: vi.fn().mockImplementation((cb: (em: EntityManager) => Promise<unknown>) => cb(mockManager)),
    } as unknown as DataSource

    service = new InvoicesService(
      invoiceRepo as unknown as Repository<Invoice>,
      lineItemRepo as unknown as Repository<InvoiceLineItem>,
      extraRepo as unknown as Repository<InvoiceExtra>,
      mockDataSource,
      companyService as unknown as CompanyService,
    )
  })

  describe('create', () => {
    it('should throw BadRequestException if no company', async () => {
      companyService.findByUser.mockResolvedValue(null)

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          issueDate: '2026-01-15',
          dueDate: '2026-02-15',
          currency: 'USD',
          description: 'Test',
          lineItems: [{ description: 'Work', quantity: 10, unitPrice: 100, sortOrder: 0 }],
          extras: [],
          template: 'classic',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should create invoice with computed totals', async () => {
      companyService.findByUser.mockResolvedValue(COMPANY)
      invoiceRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ maxSeq: null }),
      })

      const savedInvoice = makeInvoice({ id: 'new-id', invoiceNumber: 'INV-0001' })
      ;(mockManager.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(savedInvoice)

      const result = await service.create('user-1', {
        clientId: 'client-1',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        currency: 'USD',
        description: 'Test',
        lineItems: [
          { description: 'Dev', quantity: 160, unitPrice: 50, sortOrder: 0 },
          { description: 'QA', quantity: 10, unitPrice: 80, sortOrder: 1 },
        ],
        extras: [{ description: 'Bonus', amount: 500, sortOrder: 0 }],
      })

      expect(result.invoiceNumber).toBe('INV-0001')
      expect(mockManager.save).toHaveBeenCalled()
    })
  })

  describe('findOne', () => {
    it('should return invoice detail when found', async () => {
      const invoice = makeInvoice()
      invoice.lineItems = [
        {
          id: 'li-1',
          description: 'Dev',
          quantity: 160,
          unitPrice: 50,
          sortOrder: 0,
          invoiceId: 'inv-1',
          createdAt: NOW,
          updatedAt: NOW,
        } as InvoiceLineItem,
      ]
      invoice.extraItems = []

      invoiceRepo.findOne.mockResolvedValue(invoice)

      const result = await service.findOne('user-1', 'inv-1')

      expect(result.id).toBe('inv-1')
      expect(result.lineItems).toHaveLength(1)
      expect(result.lineItems[0].amount).toBe(8000)
    })

    it('should throw NotFoundException if not found', async () => {
      invoiceRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('user-1', 'inv-1')).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException for wrong user', async () => {
      invoiceRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('user-2', 'inv-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('should throw NotFoundException if not found', async () => {
      invoiceRepo.findOneBy.mockResolvedValue(null)

      await expect(
        service.update('user-1', 'inv-1', {
          clientId: 'c1',
          issueDate: '2026-01-15',
          dueDate: '2026-02-15',
          currency: 'USD',
          description: 'Test',
          lineItems: [{ description: 'Work', quantity: 10, unitPrice: 100, sortOrder: 0 }],
          extras: [],
          template: 'classic',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw ConflictException if not draft', async () => {
      invoiceRepo.findOneBy.mockResolvedValue(makeInvoice({ status: 'sent' }))

      await expect(
        service.update('user-1', 'inv-1', {
          clientId: 'c1',
          issueDate: '2026-01-15',
          dueDate: '2026-02-15',
          currency: 'USD',
          description: 'Test',
          lineItems: [{ description: 'Work', quantity: 10, unitPrice: 100, sortOrder: 0 }],
          extras: [],
          template: 'classic',
        }),
      ).rejects.toThrow(ConflictException)
    })

    it('should update draft invoice successfully', async () => {
      invoiceRepo.findOneBy.mockResolvedValue(makeInvoice({ status: 'draft' }))

      const updated = makeInvoice({ status: 'draft' })
      ;(mockManager.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(updated)

      const result = await service.update('user-1', 'inv-1', {
        clientId: 'client-1',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        currency: 'USD',
        description: 'Updated',
        lineItems: [{ description: 'Work', quantity: 20, unitPrice: 100, sortOrder: 0 }],
        extras: [],
        template: 'classic',
      })

      expect(result).toBeDefined()
      expect(mockManager.delete).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateStatus', () => {
    it('should allow draft → sent', async () => {
      const invoice = makeInvoice({ status: 'draft' })
      invoiceRepo.findOne.mockResolvedValue(invoice)

      const updated = makeInvoice({ status: 'sent', sentAt: NOW })
      invoiceRepo.findOne
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce({ ...updated, lineItems: [], extraItems: [] })

      const result = await service.updateStatus('user-1', 'inv-1', { status: 'sent' })

      expect(invoiceRepo.update).toHaveBeenCalledWith('inv-1', expect.objectContaining({ status: 'sent' }))
      expect(result).toBeDefined()
    })

    it('should allow sent → paid', async () => {
      const invoice = makeInvoice({ status: 'sent' })
      invoiceRepo.findOne
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce({ ...invoice, status: 'paid', paidAt: NOW, lineItems: [], extraItems: [] })

      await service.updateStatus('user-1', 'inv-1', { status: 'paid' })

      expect(invoiceRepo.update).toHaveBeenCalledWith('inv-1', expect.objectContaining({ status: 'paid' }))
    })

    it('should reject paid → sent', async () => {
      invoiceRepo.findOne.mockResolvedValue(makeInvoice({ status: 'paid' }))

      await expect(service.updateStatus('user-1', 'inv-1', { status: 'sent' })).rejects.toThrow(
        ConflictException,
      )
    })

    it('should reject cancelled → draft', async () => {
      invoiceRepo.findOne.mockResolvedValue(makeInvoice({ status: 'cancelled' }))

      await expect(service.updateStatus('user-1', 'inv-1', { status: 'draft' })).rejects.toThrow(
        ConflictException,
      )
    })

    it('should throw NotFoundException for wrong user', async () => {
      invoiceRepo.findOne.mockResolvedValue(null)

      await expect(service.updateStatus('user-2', 'inv-1', { status: 'sent' })).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('findByClient', () => {
    it('should return invoices sorted by issueDate DESC', async () => {
      invoiceRepo.find.mockResolvedValue([
        makeInvoice({ issueDate: '2026-02-01' }),
        makeInvoice({ issueDate: '2026-01-01' }),
      ])

      const result = await service.findByClient('user-1', 'client-1')

      expect(result).toHaveLength(2)
      expect(invoiceRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', clientId: 'client-1' },
        order: { issueDate: 'DESC' },
      })
    })
  })

  describe('countByClient', () => {
    it('should return count', async () => {
      invoiceRepo.countBy.mockResolvedValue(3)

      const count = await service.countByClient('user-1', 'client-1')

      expect(count).toBe(3)
      expect(invoiceRepo.countBy).toHaveBeenCalledWith({ userId: 'user-1', clientId: 'client-1' })
    })
  })

  describe('findAll', () => {
    it('should return paginated results with default sorting', async () => {
      const qb = {
        leftJoin: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(1),
        getMany: vi.fn().mockResolvedValue([makeInvoice()]),
      }
      invoiceRepo.createQueryBuilder.mockReturnValue(qb)

      const result = await service.findAll('user-1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(qb.orderBy).toHaveBeenCalledWith('invoice.issueDate', 'DESC')
    })

    it('should apply search filter', async () => {
      const qb = {
        leftJoin: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      }
      invoiceRepo.createQueryBuilder.mockReturnValue(qb)

      await service.findAll('user-1', { search: 'acme', page: 1, limit: 10 })

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%acme%' }),
      )
    })
  })
})
