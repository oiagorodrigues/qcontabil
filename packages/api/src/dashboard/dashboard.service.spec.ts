import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DataSource } from 'typeorm'
import { DashboardService } from './dashboard.service'

function makeDataSource(queryResults: unknown[][]): DataSource {
  const queryMock = vi.fn()
  queryResults.forEach((result) => queryMock.mockResolvedValueOnce(result))
  return { query: queryMock } as unknown as DataSource
}

describe('DashboardService', () => {
  describe('getPeriodRanges', () => {
    it('returns correct month range', () => {
      const service = new DashboardService({ query: vi.fn() } as unknown as DataSource)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15'))

      const { current, previous } = service.getPeriodRanges('month')

      expect(current.start).toEqual(new Date(2026, 2, 1))
      expect(current.end).toEqual(new Date(2026, 3, 0))
      expect(previous.start).toEqual(new Date(2026, 1, 1))
      expect(previous.end).toEqual(new Date(2026, 2, 0))

      vi.useRealTimers()
    })

    it('returns correct quarter range for Q1', () => {
      const service = new DashboardService({ query: vi.fn() } as unknown as DataSource)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-10'))

      const { current, previous } = service.getPeriodRanges('quarter')

      expect(current.start).toEqual(new Date(2026, 0, 1))
      expect(current.end).toEqual(new Date(2026, 3, 0))
      expect(previous.start).toEqual(new Date(2025, 9, 1))
      expect(previous.end).toEqual(new Date(2026, 0, 0))

      vi.useRealTimers()
    })

    it('returns correct year range', () => {
      const service = new DashboardService({ query: vi.fn() } as unknown as DataSource)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-01'))

      const { current } = service.getPeriodRanges('year')

      expect(current.start).toEqual(new Date(2026, 0, 1))
      expect(current.end).toEqual(new Date(2026, 11, 31))

      vi.useRealTimers()
    })
  })

  describe('getSummary', () => {
    it('returns zeros when no invoices exist', async () => {
      // 9 queries: sumBilled(curr), sumBilled(prev), sumPending(curr), sumPending(prev),
      //            sumReceived(curr), sumReceived(prev), countByStatus, recentInvoices, currencies
      const ds = makeDataSource([
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [],
        [],
        [],
      ])
      const service = new DashboardService(ds)

      const result = await service.getSummary('user-1', 'month')

      expect(result.totalBilled.total).toBe(0)
      expect(result.totalPending.total).toBe(0)
      expect(result.totalReceived.total).toBe(0)
      expect(result.invoiceCount).toEqual({ draft: 0, sent: 0, paid: 0, cancelled: 0 })
      expect(result.recentInvoices).toEqual([])
      expect(result.availableCurrencies).toEqual([])
      expect(result.defaultCurrency).toBe('USD')
    })

    it('calculates percentChange correctly', async () => {
      const ds = makeDataSource([
        [{ total: '1200' }], // billed current
        [{ total: '1000' }], // billed previous
        [{ total: '200' }],  // pending current
        [{ total: '200' }],  // pending previous
        [{ total: '1000' }], // received current
        [{ total: '800' }],  // received previous
        [],
        [],
        [],
      ])
      const service = new DashboardService(ds)

      const result = await service.getSummary('user-1', 'month')

      expect(result.totalBilled.percentChange).toBe(20)
      expect(result.totalPending.percentChange).toBe(0)
      expect(result.totalReceived.percentChange).toBe(25)
    })

    it('sets percentChange to null when previous is zero', async () => {
      const ds = makeDataSource([
        [{ total: '500' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '500' }],
        [{ total: '0' }],
        [],
        [],
        [],
      ])
      const service = new DashboardService(ds)

      const result = await service.getSummary('user-1', 'month')

      expect(result.totalBilled.percentChange).toBeNull()
    })

    it('uses defaultCurrency from most frequent currency', async () => {
      const ds = makeDataSource([
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [{ total: '0' }],
        [],
        [],
        [
          { currency: 'USD', count: '10' },
          { currency: 'EUR', count: '3' },
        ],
      ])
      const service = new DashboardService(ds)

      const result = await service.getSummary('user-1', 'month')

      expect(result.defaultCurrency).toBe('USD')
      expect(result.availableCurrencies).toEqual(['USD', 'EUR'])
    })
  })

  describe('getRevenueChart', () => {
    it('fills missing months with total=0', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15'))

      // Only February has data
      const ds = makeDataSource([
        [{ year: '2026', month: '2', total: '5000' }],
      ])
      const service = new DashboardService(ds)

      const result = await service.getRevenueChart('user-1', 'month')

      expect(result.data).toHaveLength(1)
      expect(result.data[0].label).toBe('Mar')
      expect(result.data[0].total).toBe(0)

      vi.useRealTimers()
    })

    it('returns correct months for last12 period', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15'))

      const ds = makeDataSource([[]])
      const service = new DashboardService(ds)

      const result = await service.getRevenueChart('user-1', 'last12')

      expect(result.data).toHaveLength(12)
      expect(result.data[0].label).toBe('Abr') // Apr 2025
      expect(result.data[11].label).toBe('Mar') // Mar 2026

      vi.useRealTimers()
    })
  })

  describe('getTopClients', () => {
    it('calculates percentage correctly', async () => {
      const ds = makeDataSource([
        [
          { clientId: 'c1', clientName: 'Acme', total: '6000' },
          { clientId: 'c2', clientName: 'Beta', total: '4000' },
        ],
      ])
      const service = new DashboardService(ds)

      const result = await service.getTopClients('user-1', 'month')

      expect(result.clients[0].percentage).toBe(60)
      expect(result.clients[1].percentage).toBe(40)
    })

    it('returns empty array when no clients', async () => {
      const ds = makeDataSource([[]])
      const service = new DashboardService(ds)

      const result = await service.getTopClients('user-1', 'month')

      expect(result.clients).toEqual([])
    })

    it('returns 0% when grandTotal is zero', async () => {
      const ds = makeDataSource([
        [{ clientId: 'c1', clientName: 'Acme', total: '0' }],
      ])
      const service = new DashboardService(ds)

      const result = await service.getTopClients('user-1', 'month')

      expect(result.clients[0].percentage).toBe(0)
    })
  })
})
