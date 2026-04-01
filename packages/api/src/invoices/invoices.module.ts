import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Invoice } from './entities/invoice.entity'
import { InvoiceLineItem } from './entities/invoice-line-item.entity'
import { InvoiceExtra } from './entities/invoice-extra.entity'
import { InvoicesService } from './invoices.service'
import { InvoicesController } from './invoices.controller'
import { PdfService } from './pdf.service'
import { CompanyModule } from '../company/company.module'

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceLineItem, InvoiceExtra]), CompanyModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
