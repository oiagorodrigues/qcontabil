import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  ListInvoicesQuery,
  InvoiceSummary,
  InvoiceDetail,
  InvoiceClientSummary,
  InvoiceLineItemResponse,
  InvoiceExtraResponse,
  PaginatedResponse,
} from '@qcontabil/shared'
import { Invoice } from './entities/invoice.entity'
import { InvoiceLineItem } from './entities/invoice-line-item.entity'
import { InvoiceExtra } from './entities/invoice-extra.entity'
import { CompanyService } from '../company/company.service'

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepository: Repository<InvoiceLineItem>,
    @InjectRepository(InvoiceExtra)
    private readonly extraRepository: Repository<InvoiceExtra>,
    private readonly dataSource: DataSource,
    private readonly companyService: CompanyService,
  ) {}

  async create(userId: string, dto: CreateInvoiceInput): Promise<InvoiceDetail> {
    const company = await this.companyService.findByUser(userId)
    if (!company) {
      throw new BadRequestException('Set up your company info before creating invoices')
    }

    const invoiceNumber = await this.generateInvoiceNumber(userId, company.invoicePrefix)
    const subtotal = dto.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0)
    const extrasTotal = (dto.extras ?? []).reduce((sum, e) => sum + e.amount, 0)
    const total = subtotal + extrasTotal

    return this.dataSource.transaction(async (manager) => {
      const invoice = manager.create(Invoice, {
        invoiceNumber,
        status: 'draft',
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        currency: dto.currency,
        description: dto.description,
        notes: dto.notes || null,
        paymentInstructions: dto.paymentInstructions || null,
        subtotal,
        extrasTotal,
        total,
        clientId: dto.clientId,
        userId,
      })
      const savedInvoice = await manager.save(Invoice, invoice)

      const lineItems = dto.lineItems.map((li, idx) =>
        manager.create(InvoiceLineItem, {
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          sortOrder: li.sortOrder ?? idx,
          invoiceId: savedInvoice.id,
        }),
      )
      const savedLineItems = await manager.save(InvoiceLineItem, lineItems)

      const extras = (dto.extras ?? []).map((e, idx) =>
        manager.create(InvoiceExtra, {
          description: e.description,
          amount: e.amount,
          sortOrder: e.sortOrder ?? idx,
          invoiceId: savedInvoice.id,
        }),
      )
      const savedExtras = await manager.save(InvoiceExtra, extras)

      const invoiceWithClient = await manager.findOne(Invoice, {
        where: { id: savedInvoice.id },
        relations: ['client'],
      })

      return this.toDetail(invoiceWithClient!, savedLineItems, savedExtras)
    })
  }

  async findAll(
    userId: string,
    query: ListInvoicesQuery,
  ): Promise<PaginatedResponse<InvoiceSummary>> {
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.client', 'client')
      .addSelect(['client.fantasyName', 'client.id'])
      .where('invoice.userId = :userId', { userId })

    if (query.search) {
      qb.andWhere(
        '(invoice.invoiceNumber ILIKE :search OR client.fantasyName ILIKE :search)',
        { search: `%${query.search}%` },
      )
    }

    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status })
    }

    if (query.clientId) {
      qb.andWhere('invoice.clientId = :clientId', { clientId: query.clientId })
    }

    if (query.sort) {
      const [field, direction] = query.sort.split(':') as [string, 'asc' | 'desc']
      qb.orderBy(`invoice.${field}`, direction.toUpperCase() as 'ASC' | 'DESC')
    } else {
      qb.orderBy('invoice.issueDate', 'DESC')
    }

    const total = await qb.getCount()
    const offset = (query.page - 1) * query.limit
    const invoices = await qb.skip(offset).take(query.limit).getMany()

    return {
      data: invoices.map((inv) => this.toSummary(inv)),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async findOne(userId: string, invoiceId: string): Promise<InvoiceDetail> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, userId },
      relations: ['client', 'lineItems', 'extraItems'],
    })

    if (!invoice) {
      throw new NotFoundException('Invoice not found')
    }

    return this.toDetail(invoice, invoice.lineItems, invoice.extraItems)
  }

  async update(userId: string, invoiceId: string, dto: UpdateInvoiceInput): Promise<InvoiceDetail> {
    const existing = await this.invoiceRepository.findOneBy({ id: invoiceId, userId })
    if (!existing) {
      throw new NotFoundException('Invoice not found')
    }

    if (existing.status !== 'draft') {
      throw new ConflictException('Only draft invoices can be edited')
    }

    const subtotal = dto.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0)
    const extrasTotal = (dto.extras ?? []).reduce((sum, e) => sum + e.amount, 0)
    const total = subtotal + extrasTotal

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Invoice, invoiceId, {
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        currency: dto.currency,
        description: dto.description,
        notes: dto.notes || null,
        paymentInstructions: dto.paymentInstructions || null,
        subtotal,
        extrasTotal,
        total,
        clientId: dto.clientId,
      })

      await manager.delete(InvoiceLineItem, { invoiceId })
      await manager.delete(InvoiceExtra, { invoiceId })

      const lineItems = dto.lineItems.map((li, idx) =>
        manager.create(InvoiceLineItem, {
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          sortOrder: li.sortOrder ?? idx,
          invoiceId,
        }),
      )
      const savedLineItems = await manager.save(InvoiceLineItem, lineItems)

      const extras = (dto.extras ?? []).map((e, idx) =>
        manager.create(InvoiceExtra, {
          description: e.description,
          amount: e.amount,
          sortOrder: e.sortOrder ?? idx,
          invoiceId,
        }),
      )
      const savedExtras = await manager.save(InvoiceExtra, extras)

      const updatedInvoice = await manager.findOne(Invoice, {
        where: { id: invoiceId },
        relations: ['client'],
      })

      return this.toDetail(updatedInvoice!, savedLineItems, savedExtras)
    })
  }

  async updateStatus(
    userId: string,
    invoiceId: string,
    dto: UpdateInvoiceStatusInput,
  ): Promise<InvoiceDetail> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, userId },
      relations: ['client', 'lineItems', 'extraItems'],
    })

    if (!invoice) {
      throw new NotFoundException('Invoice not found')
    }

    const allowed = VALID_TRANSITIONS[invoice.status] ?? []
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(
        `Cannot change status from '${invoice.status}' to '${dto.status}'`,
      )
    }

    const updates: Partial<Invoice> = { status: dto.status }
    if (dto.status === 'sent') updates.sentAt = new Date()
    if (dto.status === 'paid') updates.paidAt = new Date()

    await this.invoiceRepository.update(invoiceId, updates)

    const updated = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['client', 'lineItems', 'extraItems'],
    })

    return this.toDetail(updated!, updated!.lineItems, updated!.extraItems)
  }

  async duplicate(userId: string, invoiceId: string): Promise<InvoiceDetail> {
    const company = await this.companyService.findByUser(userId)
    if (!company) {
      throw new BadRequestException('Set up your company info before creating invoices')
    }

    const original = await this.invoiceRepository.findOne({
      where: { id: invoiceId, userId },
      relations: ['client', 'lineItems', 'extraItems'],
    })

    if (!original) {
      throw new NotFoundException('Invoice not found')
    }

    const today = new Date().toISOString().split('T')[0]
    const invoiceNumber = await this.generateInvoiceNumber(userId, company.invoicePrefix)

    const dto: CreateInvoiceInput = {
      clientId: original.clientId,
      issueDate: today,
      dueDate: today,
      currency: original.currency as CreateInvoiceInput['currency'],
      description: original.description,
      notes: original.notes ?? undefined,
      paymentInstructions: original.paymentInstructions ?? undefined,
      lineItems: original.lineItems.map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        sortOrder: li.sortOrder,
      })),
      extras: original.extraItems.map((e) => ({
        description: e.description,
        amount: Number(e.amount),
        sortOrder: e.sortOrder,
      })),
    }

    const subtotal = dto.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0)
    const extrasTotal = (dto.extras ?? []).reduce((sum, e) => sum + e.amount, 0)
    const total = subtotal + extrasTotal

    return this.dataSource.transaction(async (manager) => {
      const invoice = manager.create(Invoice, {
        invoiceNumber,
        status: 'draft',
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        currency: dto.currency,
        description: dto.description,
        notes: dto.notes || null,
        paymentInstructions: dto.paymentInstructions || null,
        subtotal,
        extrasTotal,
        total,
        clientId: dto.clientId,
        userId,
      })
      const savedInvoice = await manager.save(Invoice, invoice)

      const lineItems = dto.lineItems.map((li, idx) =>
        manager.create(InvoiceLineItem, {
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          sortOrder: li.sortOrder ?? idx,
          invoiceId: savedInvoice.id,
        }),
      )
      const savedLineItems = await manager.save(InvoiceLineItem, lineItems)

      const extras = (dto.extras ?? []).map((e, idx) =>
        manager.create(InvoiceExtra, {
          description: e.description,
          amount: e.amount,
          sortOrder: e.sortOrder ?? idx,
          invoiceId: savedInvoice.id,
        }),
      )
      const savedExtras = await manager.save(InvoiceExtra, extras)

      const invoiceWithClient = await manager.findOne(Invoice, {
        where: { id: savedInvoice.id },
        relations: ['client'],
      })

      return this.toDetail(invoiceWithClient!, savedLineItems, savedExtras)
    })
  }

  async findByClient(userId: string, clientId: string): Promise<InvoiceClientSummary[]> {
    const invoices = await this.invoiceRepository.find({
      where: { userId, clientId },
      order: { issueDate: 'DESC' },
    })

    return invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status as InvoiceClientSummary['status'],
      issueDate: inv.issueDate,
      total: Number(inv.total),
      currency: inv.currency as InvoiceClientSummary['currency'],
    }))
  }

  async countByClient(userId: string, clientId: string): Promise<number> {
    return this.invoiceRepository.countBy({ userId, clientId })
  }

  private async generateInvoiceNumber(userId: string, prefix: string): Promise<string> {
    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select(
        `MAX(CAST(SPLIT_PART(invoice.invoiceNumber, '-', 2) AS INTEGER))`,
        'maxSeq',
      )
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.invoiceNumber LIKE :pattern', { pattern: `${prefix}-%` })
      .getRawOne<{ maxSeq: number | null }>()

    const nextSeq = (result?.maxSeq ?? 0) + 1
    return `${prefix}-${String(nextSeq).padStart(4, '0')}`
  }

  private toSummary(invoice: Invoice): InvoiceSummary {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status as InvoiceSummary['status'],
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency as InvoiceSummary['currency'],
      total: Number(invoice.total),
      clientFantasyName: invoice.client?.fantasyName ?? '',
      clientId: invoice.clientId,
      createdAt: invoice.createdAt.toISOString(),
    }
  }

  private toDetail(
    invoice: Invoice,
    lineItems: InvoiceLineItem[],
    extraItems: InvoiceExtra[],
  ): InvoiceDetail {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status as InvoiceDetail['status'],
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      sentAt: invoice.sentAt ? invoice.sentAt.toISOString() : null,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      currency: invoice.currency as InvoiceDetail['currency'],
      description: invoice.description,
      notes: invoice.notes,
      paymentInstructions: invoice.paymentInstructions,
      subtotal: Number(invoice.subtotal),
      extrasTotal: Number(invoice.extrasTotal),
      total: Number(invoice.total),
      clientId: invoice.clientId,
      client: {
        fantasyName: invoice.client?.fantasyName ?? '',
        company: invoice.client?.company ?? '',
        email: invoice.client?.email ?? '',
        address: invoice.client?.address ?? null,
        country: invoice.client?.country ?? '',
        countryCode: invoice.client?.countryCode ?? '',
      },
      lineItems: lineItems.map((li) => this.toLineItemResponse(li)),
      extraItems: extraItems.map((e) => this.toExtraResponse(e)),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    }
  }

  private toLineItemResponse(li: InvoiceLineItem): InvoiceLineItemResponse {
    return {
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      amount: Number(li.quantity) * Number(li.unitPrice),
      sortOrder: li.sortOrder,
    }
  }

  private toExtraResponse(e: InvoiceExtra): InvoiceExtraResponse {
    return {
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      sortOrder: e.sortOrder,
    }
  }
}
