import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { CreateCompanyInput } from '@qcontabil/shared'
import { TaxRegime, BrazilianState } from '@qcontabil/shared'

const WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function calcDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0)
  const r = sum % 11
  return r < 2 ? 0 : 11 - r
}

export function randomCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  // Avoid all same digits
  if (base.every((d) => d === base[0])) base[11] = (base[0] + 1) % 10
  const d1 = calcDigit(base, WEIGHTS_FIRST)
  const d2 = calcDigit([...base, d1], WEIGHTS_SECOND)
  return [...base, d1, d2].join('')
}

export function validCompanyData(overrides?: Partial<CreateCompanyInput>): CreateCompanyInput {
  return {
    legalName: 'Test Tecnologia LTDA',
    cnpj: randomCnpj(),
    taxRegime: TaxRegime.LTDA,
    email: 'empresa@test.com',
    phone: '11999999999',
    street: 'Rua Teste',
    streetNumber: '123',
    zipCode: '01420903',
    city: 'Sao Paulo',
    state: BrazilianState.SP,
    country: 'Brazil',
    invoicePrefix: 'INV',
    ...overrides,
  }
}

export async function createCompany(
  app: INestApplication,
  cookies: string[],
  data?: Partial<CreateCompanyInput>,
) {
  return request(app.getHttpServer())
    .post('/api/companies')
    .set('Cookie', cookies)
    .send(validCompanyData(data))
}
