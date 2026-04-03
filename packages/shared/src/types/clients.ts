import type { ClientStatus, Currency } from '../schemas/clients'

export interface ContactResponse {
  id: string
  name: string
  email: string
  phone: string | null
  role: string | null
  isPrimary: boolean
}

export interface ClientSummary {
  id: string
  fantasyName: string
  company: string
  country: string
  countryCode: string
  currency: Currency
  status: ClientStatus
  primaryContactName: string
  primaryContactEmail: string
  createdAt: string
}

export interface ClientDetail {
  id: string
  fantasyName: string
  company: string
  country: string
  countryCode: string
  email: string
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  currency: Currency
  status: ClientStatus
  contacts: ContactResponse[]
  paymentProviderPayeeId: string | null
  autoSendDay: number | null
  createdAt: string
  updatedAt: string
}
