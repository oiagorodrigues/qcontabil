import { Controller, Post, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import * as express from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { PaymentsService } from './payments.service'

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('tipalti')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleTipaltiWebhook(
    @Req() req: RawBodyRequest<express.Request>,
    @Headers('x-tipalti-signature') signature: string,
  ): Promise<void> {
    const rawBody = req.rawBody ?? Buffer.alloc(0)
    await this.paymentsService.handleWebhook('tipalti', rawBody, signature ?? '')
  }
}
