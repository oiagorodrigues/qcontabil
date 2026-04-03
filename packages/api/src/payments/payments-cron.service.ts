import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PaymentsService } from './payments.service'

@Injectable()
export class PaymentsCronService {
  private readonly logger = new Logger(PaymentsCronService.name)

  constructor(private readonly paymentsService: PaymentsService) {}

  /** Runs daily at 08:00 UTC. Submits invoices for clients with autoSendDay = today. */
  @Cron('0 8 * * *')
  async runAutoSend(): Promise<void> {
    this.logger.log('Auto-send cron started')
    try {
      await this.paymentsService.processAutoSend()
      this.logger.log('Auto-send cron completed')
    } catch (err) {
      this.logger.error('Auto-send cron failed', err)
    }
  }
}
