import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import type { Repository, ObjectLiteral } from 'typeorm'
import { CompanyService } from './company.service'
import type { Company } from './company.entity'
import { TaxRegime, BrazilianState } from '@qcontabil/shared'
import type { CreateCompanyInput } from '@qcontabil/shared'

type MockRepo<T extends ObjectLiteral> = Pick<Repository<T>, 'findOneBy' | 'create' | 'save'>

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> & {
  findOneBy: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
} {
  return {
    findOneBy: vi.fn(),
    create: vi.fn((data: Partial<T>) => data),
    save: vi.fn().mockImplementation((entity: T) =>
      Promise.resolve({
        ...entity,
        id: 'company-1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      }),
    ),
  } as MockRepo<T> & {
    findOneBy: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
  }
}

const validInput: CreateCompanyInput = {
  legalName: 'Test LTDA',
  cnpj: '43378917000137',
  taxRegime: TaxRegime.LTDA,
  email: 'test@example.com',
  phone: '11999999999',
  street: 'Rua Test',
  streetNumber: '123',
  zipCode: '01420903',
  city: 'Sao Paulo',
  state: BrazilianState.SP,
  country: 'Brazil',
}

describe('CompanyService', () => {
  let service: CompanyService
  let repo: ReturnType<typeof createMockRepo<Company>>

  beforeEach(() => {
    repo = createMockRepo<Company>()
    service = new CompanyService(
      repo as unknown as Repository<Company>,
      { get: () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo=' } as unknown as import('@nestjs/config').ConfigService,
    )
  })

  describe('create', () => {
    it('creates company successfully', async () => {
      repo.findOneBy.mockResolvedValue(null)

      const result = await service.create('user-1', validInput)

      expect(result.legalName).toBe('Test LTDA')
      expect(result.cnpj).toBe('43378917000137')
      expect(repo.create).toHaveBeenCalledWith({ ...validInput, userId: 'user-1' })
      expect(repo.save).toHaveBeenCalled()
    })

    it('throws ConflictException when user already has a company', async () => {
      repo.findOneBy.mockImplementation((where: Record<string, unknown>) => {
        if ('userId' in where) return Promise.resolve({ id: 'existing' })
        return Promise.resolve(null)
      })

      await expect(service.create('user-1', validInput)).rejects.toThrow(ConflictException)
      await expect(service.create('user-1', validInput)).rejects.toThrow(
        'Voce ja possui uma empresa cadastrada',
      )
    })

    it('throws ConflictException when CNPJ already exists', async () => {
      repo.findOneBy.mockImplementation((where: Record<string, unknown>) => {
        if ('userId' in where) return Promise.resolve(null)
        if ('cnpj' in where) return Promise.resolve({ id: 'other' })
        return Promise.resolve(null)
      })

      await expect(service.create('user-1', validInput)).rejects.toThrow(ConflictException)
      await expect(service.create('user-1', validInput)).rejects.toThrow('CNPJ ja cadastrado')
    })
  })

  describe('findByUser', () => {
    it('returns company when found', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'company-1',
        userId: 'user-1',
        ...validInput,
        complement: null,
        bankBeneficiaryName: null,
        bankName: null,
        bankAccountType: null,
        bankAccountNumber: null,
        bankSwiftCode: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      })

      const result = await service.findByUser('user-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('company-1')
      expect(result!.legalName).toBe('Test LTDA')
    })

    it('returns null when no company found', async () => {
      repo.findOneBy.mockResolvedValue(null)

      const result = await service.findByUser('user-1')

      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    const existingCompany = {
      id: 'company-1',
      userId: 'user-1',
      ...validInput,
      complement: null,
      bankBeneficiaryName: null,
      bankName: null,
      bankAccountType: null,
      bankAccountNumber: null,
      bankSwiftCode: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }

    it('updates company successfully', async () => {
      repo.findOneBy.mockResolvedValue({ ...existingCompany })

      const result = await service.update('user-1', {
        ...validInput,
        legalName: 'Updated LTDA',
      })

      expect(result.legalName).toBe('Updated LTDA')
      expect(repo.save).toHaveBeenCalled()
    })

    it('throws NotFoundException when company does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null)

      await expect(service.update('user-1', validInput)).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when changing to duplicate CNPJ', async () => {
      repo.findOneBy.mockImplementation((where: Record<string, unknown>) => {
        if ('userId' in where) return Promise.resolve({ ...existingCompany })
        if ('cnpj' in where) return Promise.resolve({ id: 'other-company' })
        return Promise.resolve(null)
      })

      await expect(
        service.update('user-1', { ...validInput, cnpj: '11222333000181' }),
      ).rejects.toThrow(ConflictException)
    })

    it('allows update with same CNPJ', async () => {
      repo.findOneBy.mockImplementation((where: Record<string, unknown>) => {
        if ('userId' in where) return Promise.resolve({ ...existingCompany })
        return Promise.resolve(null)
      })

      const result = await service.update('user-1', validInput)

      expect(result.cnpj).toBe(validInput.cnpj)
    })
  })
})
