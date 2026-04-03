import { Controller, Get, Query } from '@nestjs/common'
import { dashboardQuerySchema } from '@qcontabil/shared'
import type { DashboardQueryInput } from '@qcontabil/shared'
import { DashboardService } from './dashboard.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import type { User } from '../auth/entities/user.entity'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQueryInput,
  ) {
    return this.dashboardService.getSummary(user.id, query.period, query.currency)
  }

  @Get('revenue-chart')
  async getRevenueChart(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQueryInput,
  ) {
    return this.dashboardService.getRevenueChart(user.id, query.period, query.currency)
  }

  @Get('top-clients')
  async getTopClients(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQueryInput,
  ) {
    return this.dashboardService.getTopClients(user.id, query.period, query.currency)
  }
}
