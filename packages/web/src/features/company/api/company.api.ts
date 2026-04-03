import type {
  CompanyResponse,
  CreateCompanyInput,
  UpdateCompanyInput,
  PaymentProviderConfigInput,
} from '@qcontabil/shared'
import { httpClient } from '../../../lib/http-client'

export const companyApi = {
  getMyCompany() {
    return httpClient.get<CompanyResponse>('/companies/me')
  },

  createCompany(data: CreateCompanyInput) {
    return httpClient.post<CompanyResponse>('/companies', data)
  },

  updateCompany(data: UpdateCompanyInput) {
    return httpClient.put<CompanyResponse>('/companies/me', data)
  },

  updatePaymentConfig(data: PaymentProviderConfigInput) {
    return httpClient.put<CompanyResponse>('/companies/me/payment-config', data)
  },

  testConnection() {
    return httpClient.post<{ valid: boolean; message?: string }>('/payments/test-connection', {})
  },
}
