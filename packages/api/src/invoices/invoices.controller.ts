import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  listInvoicesQuerySchema,
} from '@qcontabil/shared'
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  ListInvoicesQuery,
} from '@qcontabil/shared'
import { InvoicesService } from './invoices.service'
import { PdfService } from './pdf.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import type { User } from '../auth/entities/user.entity'
import { CompanyService } from '../company/company.service'

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: PdfService,
    private readonly companyService: CompanyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createInvoiceSchema)) dto: CreateInvoiceInput,
  ) {
    return this.invoicesService.create(user.id, dto)
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(listInvoicesQuerySchema)) query: ListInvoicesQuery,
  ) {
    return this.invoicesService.findAll(user.id, query)
  }

  @Get('by-client/:clientId')
  async findByClient(
    @CurrentUser() user: User,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.invoicesService.findByClient(user.id, clientId)
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(user.id, id)
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) dto: UpdateInvoiceInput,
  ) {
    return this.invoicesService.update(user.id, id, dto)
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateInvoiceStatusSchema)) dto: UpdateInvoiceStatusInput,
  ) {
    return this.invoicesService.updateStatus(user.id, id, dto)
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOne(user.id, id)
    const company = await this.companyService.findByUser(user.id)
    const buffer = await this.pdfService.generate(invoice, company)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    })
    res.end(buffer)
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicate(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.duplicate(user.id, id)
  }
}
