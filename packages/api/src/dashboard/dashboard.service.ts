import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import type {
  DashboardPeriod,
  DashboardSummaryResponse,
  DashboardChartResponse,
  DashboardTopClientsResponse,
  InvoiceCountByStatus,
  SummaryCard,
  ChartDataPoint,
  InvoiceSummary,
} from '@qcontabil/shared'

interface DateRange {
  start: Date
  end: Date
}

interface PeriodRanges {
  current: DateRange
  previous: DateRange
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getSummary(
    userId: string,
    period: DashboardPeriod,
    currency?: string,
  ): Promise<DashboardSummaryResponse> {
    const { current, previous } = this.getPeriodRanges(period)

    const [
      currTotal,
      prevTotal,
      currPending,
      prevPending,
      currReceived,
      prevReceived,
      invoiceCount,
      recentInvoices,
      availableCurrencies,
    ] = await Promise.all([
      this.sumByStatus(userId, current, ['sent', 'paid'], currency),
      this.sumByStatus(userId, previous, ['sent', 'paid'], currency),
      this.sumByStatus(userId, current, ['sent'], currency),
      this.sumByStatus(userId, previous, ['sent'], currency),
      this.sumByStatus(userId, current, ['paid'], currency),
      this.sumByStatus(userId, previous, ['paid'], currency),
      this.countByStatus(userId, current, currency),
      this.getRecentInvoices(userId, currency),
      this.getAvailableCurrencies(userId),
    ])

    return {
      totalBilled: this.toSummaryCard(currTotal, prevTotal),
      totalPending: this.toSummaryCard(currPending, prevPending),
      totalReceived: this.toSummaryCard(currReceived, prevReceived),
      invoiceCount,
      recentInvoices,
      availableCurrencies: availableCurrencies.map((r) => r.currency),
      defaultCurrency: availableCurrencies[0]?.currency ?? 'USD',
    }
  }

  async getRevenueChart(
    userId: string,
    period: DashboardPeriod,
    currency?: string,
  ): Promise<DashboardChartResponse> {
    const { current } = this.getPeriodRanges(period)
    const months = this.getMonthsInRange(current)

    const rows = await this.dataSource.query<{ year: string; month: string; total: string }[]>(
      `
      SELECT
        EXTRACT(YEAR FROM issue_date::date)::text AS year,
        EXTRACT(MONTH FROM issue_date::date)::text AS month,
        COALESCE(SUM(total), 0)::text AS total
      FROM invoices
      WHERE "userId" = $1
        AND status IN ('sent', 'paid')
        AND issue_date::date >= $2
        AND issue_date::date <= $3
        ${currency ? 'AND currency = $4' : ''}
      GROUP BY year, month
      `,
      currency
        ? [userId, current.start, current.end, currency]
        : [userId, current.start, current.end],
    )

    const lookup = new Map<string, number>()
    for (const row of rows) {
      lookup.set(`${row.year}-${row.month}`, Number(row.total))
    }

    const data: ChartDataPoint[] = months.map(({ year, month, label }) => ({
      label,
      total: lookup.get(`${year}-${month}`) ?? 0,
    }))

    return { data }
  }

  async getTopClients(
    userId: string,
    period: DashboardPeriod,
    currency?: string,
  ): Promise<DashboardTopClientsResponse> {
    const { current } = this.getPeriodRanges(period)

    const rows = await this.dataSource.query<
      { clientId: string; clientName: string; total: string }[]
    >(
      `
      SELECT
        i."clientId",
        c."fantasyName" AS "clientName",
        COALESCE(SUM(i.total), 0)::text AS total
      FROM invoices i
      JOIN clients c ON c.id = i."clientId"
      WHERE i."userId" = $1
        AND i.status IN ('sent', 'paid')
        AND i.issue_date::date >= $2
        AND i.issue_date::date <= $3
        ${currency ? 'AND i.currency = $4' : ''}
      GROUP BY i."clientId", c."fantasyName"
      ORDER BY total::numeric DESC
      LIMIT 5
      `,
      currency
        ? [userId, current.start, current.end, currency]
        : [userId, current.start, current.end],
    )

    const grandTotal = rows.reduce((sum, r) => sum + Number(r.total), 0)

    const clients = rows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      total: Number(r.total),
      percentage: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100 * 10) / 10 : 0,
    }))

    return { clients }
  }

  // --- helpers ---

  getPeriodRanges(period: DashboardPeriod): PeriodRanges {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() // 0-indexed

    switch (period) {
      case 'month': {
        const start = new Date(y, m, 1)
        const end = new Date(y, m + 1, 0)
        const prevStart = new Date(y, m - 1, 1)
        const prevEnd = new Date(y, m, 0)
        return { current: { start, end }, previous: { start: prevStart, end: prevEnd } }
      }
      case 'quarter': {
        const q = Math.floor(m / 3)
        const start = new Date(y, q * 3, 1)
        const end = new Date(y, q * 3 + 3, 0)
        const prevStart = new Date(y, (q - 1) * 3, 1)
        const prevEnd = new Date(y, q * 3, 0)
        return { current: { start, end }, previous: { start: prevStart, end: prevEnd } }
      }
      case 'year': {
        const start = new Date(y, 0, 1)
        const end = new Date(y, 11, 31)
        const prevStart = new Date(y - 1, 0, 1)
        const prevEnd = new Date(y - 1, 11, 31)
        return { current: { start, end }, previous: { start: prevStart, end: prevEnd } }
      }
      case 'last12': {
        const end = new Date(y, m + 1, 0)
        const start = new Date(y - 1, m + 1, 1)
        const prevEnd = new Date(y - 1, m, 0)
        const prevStart = new Date(y - 2, m + 1, 1)
        return { current: { start, end }, previous: { start: prevStart, end: prevEnd } }
      }
    }
  }

  private async sumByStatus(
    userId: string,
    range: DateRange,
    statuses: string[],
    currency?: string,
  ): Promise<number> {
    const placeholders = statuses.map((_, i) => `$${i + 4}`).join(', ')
    const params: unknown[] = [userId, range.start, range.end, ...statuses]
    if (currency) params.push(currency)

    const rows = await this.dataSource.query<{ total: string }[]>(
      `
      SELECT COALESCE(SUM(total), 0)::text AS total
      FROM invoices
      WHERE "userId" = $1
        AND issue_date::date >= $2
        AND issue_date::date <= $3
        AND status IN (${placeholders})
        ${currency ? `AND currency = $${params.length}` : ''}
      `,
      params,
    )
    return Number(rows[0]?.total ?? 0)
  }

  private async countByStatus(
    userId: string,
    range: DateRange,
    currency?: string,
  ): Promise<InvoiceCountByStatus> {
    const params: unknown[] = [userId, range.start, range.end]
    if (currency) params.push(currency)

    const rows = await this.dataSource.query<{ status: string; count: string }[]>(
      `
      SELECT status, COUNT(*)::text AS count
      FROM invoices
      WHERE "userId" = $1
        AND issue_date::date >= $2
        AND issue_date::date <= $3
        ${currency ? `AND currency = $4` : ''}
      GROUP BY status
      `,
      params,
    )

    const counts: InvoiceCountByStatus = { draft: 0, sent: 0, paid: 0, cancelled: 0 }
    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status as keyof InvoiceCountByStatus] = Number(row.count)
      }
    }
    return counts
  }

  private async getRecentInvoices(userId: string, currency?: string): Promise<InvoiceSummary[]> {
    const params: unknown[] = [userId]
    if (currency) params.push(currency)

    const rows = await this.dataSource.query<
      {
        id: string
        invoiceNumber: string
        status: string
        issueDate: string
        dueDate: string
        currency: string
        total: string
        clientId: string
        clientFantasyName: string
        createdAt: string
      }[]
    >(
      `
      SELECT
        i.id,
        i."invoiceNumber",
        i.status,
        i.issue_date AS "issueDate",
        i.due_date AS "dueDate",
        i.currency,
        i.total::text AS total,
        i."clientId",
        c."fantasyName" AS "clientFantasyName",
        i."createdAt"
      FROM invoices i
      JOIN clients c ON c.id = i."clientId"
      WHERE i."userId" = $1
        ${currency ? 'AND i.currency = $2' : ''}
      ORDER BY i."createdAt" DESC
      LIMIT 5
      `,
      params,
    )

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      status: r.status as InvoiceSummary['status'],
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      currency: r.currency as InvoiceSummary['currency'],
      total: Number(r.total),
      clientId: r.clientId,
      clientFantasyName: r.clientFantasyName,
      createdAt: new Date(r.createdAt).toISOString(),
    }))
  }

  private async getAvailableCurrencies(
    userId: string,
  ): Promise<{ currency: InvoiceSummary['currency']; count: number }[]> {
    const rows = await this.dataSource.query<{ currency: string; count: string }[]>(
      `
      SELECT currency, COUNT(*)::text AS count
      FROM invoices
      WHERE "userId" = $1
      GROUP BY currency
      ORDER BY count::integer DESC
      `,
      [userId],
    )
    return rows.map((r) => ({
      currency: r.currency as InvoiceSummary['currency'],
      count: Number(r.count),
    }))
  }

  private toSummaryCard(current: number, previous: number): SummaryCard {
    const percentChange =
      previous > 0 ? Math.round(((current - previous) / previous) * 100 * 10) / 10 : null
    return { total: current, percentChange }
  }

  private getMonthsInRange(
    range: DateRange,
  ): { year: number; month: number; label: string }[] {
    const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const months: { year: number; month: number; label: string }[] = []
    const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1)
    const endMonth = new Date(range.end.getFullYear(), range.end.getMonth(), 1)

    while (cursor <= endMonth) {
      months.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1, // 1-indexed for EXTRACT
        label: MONTH_LABELS[cursor.getMonth()],
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  }
}
