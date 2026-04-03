import { z } from 'zod'

export const dashboardPeriodSchema = z.enum(['month', 'quarter', 'year', 'last12'])

export const dashboardQuerySchema = z.object({
  period: dashboardPeriodSchema.default('month'),
  currency: z.string().optional(),
})

export type DashboardPeriodInput = z.infer<typeof dashboardPeriodSchema>
export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>
