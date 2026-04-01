import { Injectable, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import type {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
  ClientSummary,
  ClientDetail,
  ContactResponse,
  PaginatedResponse,
} from '@qcontabil/shared'
import { Client } from './entities/client.entity'
import { Contact } from './entities/contact.entity'
import { InvoicesService } from '../invoices/invoices.service'

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
  ) {}

  async create(userId: string, dto: CreateClientInput): Promise<ClientDetail> {
    return this.dataSource.transaction(async (manager) => {
      const client = manager.create(Client, {
        fantasyName: dto.fantasyName,
        company: dto.company,
        country: dto.country,
        countryCode: dto.countryCode,
        email: dto.email,
        phone: dto.phone || null,
        website: dto.website || null,
        address: dto.address || null,
        notes: dto.notes || null,
        currency: dto.currency,
        status: dto.status,
        userId,
      })
      const savedClient = await manager.save(Client, client)

      const contacts = dto.contacts.map((c) =>
        manager.create(Contact, {
          name: c.name,
          email: c.email,
          phone: c.phone || null,
          role: c.role || null,
          isPrimary: c.isPrimary,
          clientId: savedClient.id,
        }),
      )
      const savedContacts = await manager.save(Contact, contacts)

      return this.toDetail(savedClient, savedContacts)
    })
  }

  async findAll(
    userId: string,
    query: ListClientsQuery,
  ): Promise<PaginatedResponse<ClientSummary>> {
    const qb = this.clientRepository
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.contacts', 'contact', 'contact.isPrimary = true')
      .where('client.userId = :userId', { userId })

    if (query.search) {
      qb.andWhere('(client.fantasyName ILIKE :search OR client.company ILIKE :search)', {
        search: `%${query.search}%`,
      })
    }

    if (query.status) {
      qb.andWhere('client.status = :status', { status: query.status })
    }

    if (query.country) {
      qb.andWhere('client.country = :country', { country: query.country })
    }

    if (query.sort) {
      const [field, direction] = query.sort.split(':') as [string, 'asc' | 'desc']
      qb.orderBy(`client.${field}`, direction.toUpperCase() as 'ASC' | 'DESC')
    } else {
      qb.orderBy('client.fantasyName', 'ASC')
    }

    const total = await qb.getCount()
    const offset = (query.page - 1) * query.limit
    const clients = await qb.skip(offset).take(query.limit).getMany()

    return {
      data: clients.map((client) => this.toSummary(client)),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async findOne(userId: string, clientId: string): Promise<ClientDetail> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId, userId },
      relations: ['contacts'],
    })

    if (!client) {
      throw new NotFoundException('Client not found')
    }

    return this.toDetail(client, client.contacts)
  }

  async update(userId: string, clientId: string, dto: UpdateClientInput): Promise<ClientDetail> {
    const existing = await this.clientRepository.findOneBy({ id: clientId, userId })
    if (!existing) {
      throw new NotFoundException('Client not found')
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Client, clientId, {
        fantasyName: dto.fantasyName,
        company: dto.company,
        country: dto.country,
        countryCode: dto.countryCode,
        email: dto.email,
        phone: dto.phone || null,
        website: dto.website || null,
        address: dto.address || null,
        notes: dto.notes || null,
        currency: dto.currency,
        status: dto.status,
      })

      await manager.delete(Contact, { clientId })

      const contacts = dto.contacts.map((c) =>
        manager.create(Contact, {
          name: c.name,
          email: c.email,
          phone: c.phone || null,
          role: c.role || null,
          isPrimary: c.isPrimary,
          clientId,
        }),
      )
      const savedContacts = await manager.save(Contact, contacts)

      const updatedClient = await manager.findOneByOrFail(Client, { id: clientId })
      return this.toDetail(updatedClient, savedContacts)
    })
  }

  async remove(userId: string, clientId: string): Promise<void> {
    const client = await this.clientRepository.findOneBy({ id: clientId, userId })
    if (!client) {
      throw new NotFoundException('Client not found')
    }

    const invoiceCount = await this.invoicesService.countByClient(userId, clientId)
    if (invoiceCount > 0) {
      throw new ConflictException(
        'Cannot delete client with existing invoices. Change status to inactive instead.',
      )
    }

    await this.clientRepository.remove(client)
  }

  private toSummary(client: Client): ClientSummary {
    const primaryContact = client.contacts?.find((c) => c.isPrimary)
    return {
      id: client.id,
      fantasyName: client.fantasyName,
      company: client.company,
      country: client.country,
      countryCode: client.countryCode,
      currency: client.currency as ClientSummary['currency'],
      status: client.status as ClientSummary['status'],
      primaryContactName: primaryContact?.name || '',
      primaryContactEmail: primaryContact?.email || '',
      createdAt: client.createdAt.toISOString(),
    }
  }

  private toDetail(client: Client, contacts: Contact[]): ClientDetail {
    return {
      id: client.id,
      fantasyName: client.fantasyName,
      company: client.company,
      country: client.country,
      countryCode: client.countryCode,
      email: client.email,
      phone: client.phone,
      website: client.website,
      address: client.address,
      notes: client.notes,
      currency: client.currency as ClientDetail['currency'],
      status: client.status as ClientDetail['status'],
      contacts: contacts.map((c) => this.toContactResponse(c)),
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }
  }

  private toContactResponse(contact: Contact): ContactResponse {
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      role: contact.role,
      isPrimary: contact.isPrimary,
    }
  }
}
