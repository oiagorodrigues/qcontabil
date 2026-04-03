import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import type { CreateCompanyInput, UpdateCompanyInput, CompanyResponse, PaymentProviderConfigInput } from '@qcontabil/shared'
import { Company } from './company.entity'
import { encrypt } from '../common/utils/encryption'

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: string, data: CreateCompanyInput): Promise<CompanyResponse> {
    const existing = await this.companyRepository.findOneBy({ userId })
    if (existing) {
      throw new ConflictException('Voce ja possui uma empresa cadastrada')
    }

    const cnpjExists = await this.companyRepository.findOneBy({ cnpj: data.cnpj })
    if (cnpjExists) {
      throw new ConflictException('CNPJ ja cadastrado')
    }

    const company = this.companyRepository.create({ ...data, userId })
    const saved = await this.companyRepository.save(company)
    return this.toResponse(saved)
  }

  async findByUser(userId: string): Promise<CompanyResponse | null> {
    const company = await this.companyRepository.findOneBy({ userId })
    return company ? this.toResponse(company) : null
  }

  async update(userId: string, data: UpdateCompanyInput): Promise<CompanyResponse> {
    const company = await this.companyRepository.findOneBy({ userId })
    if (!company) {
      throw new NotFoundException('Empresa nao encontrada')
    }

    if (data.cnpj !== company.cnpj) {
      const cnpjExists = await this.companyRepository.findOneBy({ cnpj: data.cnpj })
      if (cnpjExists) {
        throw new ConflictException('CNPJ ja cadastrado')
      }
    }

    Object.assign(company, data)
    const saved = await this.companyRepository.save(company)
    return this.toResponse(saved)
  }

  async updatePaymentConfig(userId: string, data: PaymentProviderConfigInput): Promise<CompanyResponse> {
    const company = await this.companyRepository.findOneBy({ userId })
    if (!company) {
      throw new NotFoundException('Empresa nao encontrada')
    }

    const encryptionKey = this.configService.get<string>('PAYMENT_ENCRYPTION_KEY')!
    const plaintext = JSON.stringify(data)
    company.paymentProvider = data.paymentProvider
    company.paymentProviderConfig = encrypt(plaintext, encryptionKey)
    const saved = await this.companyRepository.save(company)
    return this.toResponse(saved)
  }

  private toResponse(company: Company): CompanyResponse {
    return {
      id: company.id,
      legalName: company.legalName,
      cnpj: company.cnpj,
      taxRegime: company.taxRegime,
      email: company.email,
      phone: company.phone,
      street: company.street,
      streetNumber: company.streetNumber,
      complement: company.complement,
      zipCode: company.zipCode,
      city: company.city,
      state: company.state,
      country: company.country,
      bankBeneficiaryName: company.bankBeneficiaryName,
      bankName: company.bankName,
      bankAccountType: company.bankAccountType,
      bankAccountNumber: company.bankAccountNumber,
      bankSwiftCode: company.bankSwiftCode,
      invoicePrefix: company.invoicePrefix,
      defaultTemplate: company.defaultTemplate,
      paymentProvider: company.paymentProvider ?? null,
      hasPaymentProvider: company.paymentProviderConfig != null,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    }
  }
}
