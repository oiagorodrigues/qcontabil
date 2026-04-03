import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Invoice } from './entities/invoice.entity'
import { InvoiceLineItem } from './entities/invoice-line-item.entity'
import { InvoiceExtra } from './entities/invoice-extra.entity'
import { InvoicesService } from './invoices.service'
import { InvoicesController } from './invoices.controller'
import { PdfService } from './pdf.service'
import { CompanyModule } from '../company/company.module'
import { ClientsModule } from '../clients/clients.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLineItem, InvoiceExtra]),
    CompanyModule,
    forwardRef(() => ClientsModule),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfService],
  exports: [InvoicesService, PdfService],
})
export class InvoicesModule {}
