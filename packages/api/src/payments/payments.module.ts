import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { Invoice } from '../invoices/entities/invoice.entity'
import { Company } from '../company/company.entity'
import { Client } from '../clients/entities/client.entity'
import { InvoicesModule } from '../invoices/invoices.module'
import { CompanyModule } from '../company/company.module'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { WebhookController } from './webhook.controller'
import { PaymentsCronService } from './payments-cron.service'
import { PaymentProviderFactory } from './providers/payment-provider.factory'
import { TipaltiProvider } from './providers/tipalti.provider'

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Company, Client]),
    ScheduleModule.forRoot(),
    InvoicesModule,
    CompanyModule,
  ],
  controllers: [PaymentsController, WebhookController],
  providers: [
    PaymentsService,
    PaymentsCronService,
    {
      provide: PaymentProviderFactory,
      useFactory: () => {
        const factory = new PaymentProviderFactory()
        factory.register('tipalti', TipaltiProvider)
        return factory
      },
    },
  ],
})
export class PaymentsModule {}
