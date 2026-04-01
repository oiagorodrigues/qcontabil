import { z } from 'zod'
import { TaxRegime, AccountType, BrazilianState } from '../types/company'
import { isValidCnpj } from '../validators/cnpj'

export const createCompanySchema = z.object({
  // Dados gerais
  legalName: z.string().min(1, 'Razao social e obrigatoria').max(200),
  cnpj: z
    .string()
    .length(14, 'CNPJ deve ter 14 digitos')
    .regex(/^\d{14}$/, 'CNPJ deve conter apenas numeros')
    .refine(isValidCnpj, { message: 'CNPJ invalido' }),
  taxRegime: z.nativeEnum(TaxRegime, { error: 'Regime tributario invalido' }),
  email: z.email({ error: 'Email invalido' }).transform((e) => e.toLowerCase().trim()),
  phone: z.string().min(10, 'Telefone deve ter no minimo 10 digitos').max(20),

  // Endereco
  street: z.string().min(1, 'Logradouro e obrigatorio').max(200),
  streetNumber: z.string().min(1, 'Numero e obrigatorio').max(20),
  complement: z.string().max(100).optional(),
  zipCode: z
    .string()
    .length(8, 'CEP deve ter 8 digitos')
    .regex(/^\d{8}$/, 'CEP deve conter apenas numeros'),
  city: z.string().min(1, 'Cidade e obrigatoria').max(100),
  state: z.nativeEnum(BrazilianState, { error: 'Estado invalido' }),
  country: z.string().min(1, 'Pais e obrigatorio').max(100),

  // Prefixo de invoice
  invoicePrefix: z
    .string()
    .min(1, 'Prefixo e obrigatorio')
    .max(10)
    .transform((s) => s.toUpperCase()),

  // Dados bancarios (opcionais)
  bankBeneficiaryName: z.string().max(200).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountType: z.nativeEnum(AccountType).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(11).optional(),
})

export const updateCompanySchema = createCompanySchema

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
