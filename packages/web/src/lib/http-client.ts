import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let isRefreshing = false
let pendingQueue: Array<{
  resolve: (value: AxiosResponse) => void
  reject: (reason: unknown) => void
  config: AxiosRequestConfig
}> = []
let onAuthError: (() => void) | null = null

function processQueue(error: unknown) {
  for (const entry of pendingQueue) {
    entry.reject(error)
  }
  pendingQueue = []
}

function retryQueue() {
  const queue = [...pendingQueue]
  pendingQueue = []
  for (const entry of queue) {
    client.request(entry.config).then(entry.resolve, entry.reject)
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config as AxiosRequestConfig | undefined

    if (
      error.response?.status !== 401 ||
      !originalConfig ||
      (originalConfig.url ?? '').includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        pendingQueue.push({ resolve, reject, config: originalConfig })
      })
    }

    isRefreshing = true

    try {
      await client.post('/auth/refresh')
      isRefreshing = false
      retryQueue()
      return client.request(originalConfig)
    } catch (refreshError) {
      isRefreshing = false
      processQueue(refreshError)
      onAuthError?.()
      return Promise.reject(refreshError)
    }
  },
)

export function setOnAuthError(callback: () => void) {
  onAuthError = callback
}

export const httpClient = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return client.get<T>(url, config)
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return client.post<T>(url, data, config)
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return client.put<T>(url, data, config)
  },
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return client.patch<T>(url, data, config)
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return client.delete<T>(url, config)
  },
}
