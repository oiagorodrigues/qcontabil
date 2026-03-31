import type {
  CreateClientInput,
  UpdateClientInput,
  ClientDetail,
  ClientSummary,
  PaginatedResponse,
} from '@qcontabil/shared'
import { httpClient } from '@/lib/http-client'

interface ListClientsParams {
  search?: string
  status?: string
  country?: string
  sort?: string
  page?: number
  limit?: number
}

export const clientsApi = {
  create(data: CreateClientInput) {
    return httpClient.post<ClientDetail>('/clients', data)
  },

  list(params: ListClientsParams = {}) {
    return httpClient.get<PaginatedResponse<ClientSummary>>('/clients', { params })
  },

  get(id: string) {
    return httpClient.get<ClientDetail>(`/clients/${id}`)
  },

  update(id: string, data: UpdateClientInput) {
    return httpClient.put<ClientDetail>(`/clients/${id}`, data)
  },

  remove(id: string) {
    return httpClient.delete(`/clients/${id}`)
  },
}
