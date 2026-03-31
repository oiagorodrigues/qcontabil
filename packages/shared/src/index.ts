// Shared types between API and Web packages

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// Auth schemas and types
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './schemas/auth'

export type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './schemas/auth'

export type { UserProfile, AuthResponse } from './types/auth'

// Company types
export { TaxRegime, AccountType, BrazilianState } from './types/company'

export type { CompanyResponse } from './types/company'

// Company validators
export { isValidCnpj } from './validators/cnpj'

// Company schemas and types
export { createCompanySchema, updateCompanySchema } from './schemas/company'

export type { CreateCompanyInput, UpdateCompanyInput } from './schemas/company'

// Client schemas, enums, and types
export {
  CLIENT_STATUSES,
  CURRENCIES,
  clientStatusSchema,
  currencySchema,
  contactSchema,
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
} from './schemas/clients'

export type {
  ContactInput,
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
  ClientStatus,
  Currency,
} from './schemas/clients'

export type { ClientSummary, ClientDetail, ContactResponse } from './types/clients'
