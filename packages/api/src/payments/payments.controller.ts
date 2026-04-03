import { Controller, Post, Get, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { User } from '../auth/entities/user.entity'

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('send/:invoiceId')
  @HttpCode(HttpStatus.OK)
  async submitInvoice(
    @CurrentUser() user: User,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<{ message: string }> {
    await this.paymentsService.submitInvoice(user.id, invoiceId)
    return { message: 'Invoice submitted to payment provider' }
  }

  @Get('status/:invoiceId')
  async checkStatus(
    @CurrentUser() user: User,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<{ providerStatus: string }> {
    return this.paymentsService.checkStatus(user.id, invoiceId)
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @CurrentUser() user: User,
  ): Promise<{ valid: boolean; message?: string }> {
    return this.paymentsService.testConnection(user.id)
  }
}
