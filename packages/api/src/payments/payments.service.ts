import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { Invoice } from '../invoices/entities/invoice.entity'
import { Company } from '../company/company.entity'
import { Client } from '../clients/entities/client.entity'
import { InvoicesService } from '../invoices/invoices.service'
import { PdfService } from '../invoices/pdf.service'
import { PaymentProviderFactory } from './providers/payment-provider.factory'
import { decrypt } from '../common/utils/encryption'

interface PaymentConfig {
  apiKey: string
  payerEntity: string
  sandboxMode: boolean
}

const SANDBOX_URL = 'https://api.sandbox.tipalti.com'
const PRODUCTION_URL = 'https://api.tipalti.com'

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: PdfService,
    private readonly factory: PaymentProviderFactory,
    private readonly config: ConfigService,
  ) {}

  async submitInvoice(userId: string, invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, userId },
      relations: ['client', 'lineItems', 'extraItems'],
    })
    if (!invoice) throw new NotFoundException('Invoice not found')

    if (invoice.paymentProviderRef) {
      throw new BadRequestException('Invoice has already been submitted to the payment provider')
    }
    if (!['draft', 'sent'].includes(invoice.status)) {
      throw new BadRequestException(`Cannot submit invoice with status '${invoice.status}'`)
    }

    const client = invoice.client
    if (!client?.paymentProviderPayeeId) {
      throw new BadRequestException(
        'Client does not have a payment provider ID configured. Add a Payee ID to the client first.',
      )
    }

    const company = await this.companyRepository.findOneBy({ userId })
    if (!company?.paymentProvider || !company.paymentProviderConfig) {
      throw new BadRequestException(
        'Payment provider is not configured. Set up your provider in Settings.',
      )
    }

    const provider = this.buildProvider(company)
    const invoiceDetail = await this.invoicesService.findOne(userId, invoiceId)
    const pdfBuffer = await this.pdfService.generate(invoiceDetail, null)

    const result = await provider.submitInvoice({
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.total),
      currency: invoice.currency,
      description: invoice.description,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      payeeId: client.paymentProviderPayeeId,
      pdfBuffer,
    })

    await this.invoiceRepository.update(invoiceId, {
      paymentProviderRef: result.providerRef,
      paymentProviderStatus: result.status,
      status: 'sent',
      sentAt: new Date(),
    })
  }

  async checkStatus(userId: string, invoiceId: string): Promise<{ providerStatus: string }> {
    const invoice = await this.invoiceRepository.findOneBy({ id: invoiceId, userId })
    if (!invoice) throw new NotFoundException('Invoice not found')

    if (!invoice.paymentProviderRef) {
      throw new BadRequestException('Invoice has not been submitted to the payment provider yet')
    }

    const company = await this.companyRepository.findOneBy({ userId })
    if (!company?.paymentProvider || !company.paymentProviderConfig) {
      throw new BadRequestException('Payment provider is not configured')
    }

    const provider = this.buildProvider(company)
    const result = await provider.getInvoiceStatus(invoice.paymentProviderRef)

    await this.invoiceRepository.update(invoiceId, {
      paymentProviderStatus: result.status,
    })

    return { providerStatus: result.status }
  }

  async testConnection(userId: string): Promise<{ valid: boolean; message?: string }> {
    const company = await this.companyRepository.findOneBy({ userId })
    if (!company?.paymentProvider || !company.paymentProviderConfig) {
      throw new BadRequestException('Payment provider is not configured')
    }

    const provider = this.buildProvider(company)
    return provider.validateConnection()
  }

  async handleWebhook(
    providerName: string,
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    this.validateWebhookSignature(rawBody, signature)

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
    } catch {
      this.logger.warn(`Webhook from ${providerName}: invalid JSON payload`)
      return
    }

    const invoiceRef = String(payload.invoiceRef ?? payload.billId ?? '')
    const rawStatus = String(payload.status ?? '')

    if (!invoiceRef) {
      this.logger.warn(`Webhook from ${providerName}: missing invoice reference`)
      return
    }

    const invoice = await this.invoiceRepository.findOneBy({ paymentProviderRef: invoiceRef })
    if (!invoice) {
      this.logger.warn(`Webhook from ${providerName}: unknown invoice ref "${invoiceRef}"`)
      return
    }

    await this.invoiceRepository.update(invoice.id, { paymentProviderStatus: rawStatus })

    const internalStatus = this.mapProviderStatus(rawStatus)
    if (!internalStatus) return

    // Idempotent: skip if already in target status
    if (invoice.status === internalStatus) return

    try {
      await this.invoicesService.updateStatus(invoice.userId, invoice.id, {
        status: internalStatus,
      })
    } catch (err) {
      this.logger.error(`Webhook: failed to update invoice ${invoice.id} status`, err)
    }
  }

  async processAutoSend(): Promise<void> {
    const today = new Date()
    const dayOfMonth = today.getDate()

    const clients = await this.clientRepository.find({
      where: { autoSendDay: dayOfMonth, status: 'active' },
    })

    for (const client of clients) {
      const todayStr = today.toISOString().slice(0, 10)
      const invoices = await this.invoiceRepository.find({
        where: { clientId: client.id, status: 'draft' },
      })

      const eligible = invoices.filter((inv) => inv.issueDate <= todayStr)

      for (const invoice of eligible) {
        try {
          await this.submitInvoice(invoice.userId, invoice.id)
          this.logger.log(`Auto-send: invoice ${invoice.invoiceNumber} submitted successfully`)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.logger.error(`Auto-send: invoice ${invoice.invoiceNumber} failed — ${message}`)
        }
      }
    }
  }

  private buildProvider(company: Company) {
    const encryptionKey = this.config.get<string>('PAYMENT_ENCRYPTION_KEY') ?? ''
    const raw = decrypt(company.paymentProviderConfig!, encryptionKey)
    const parsed = JSON.parse(raw) as PaymentConfig

    const baseUrl = parsed.sandboxMode ? SANDBOX_URL : PRODUCTION_URL

    return this.factory.create(company.paymentProvider!, {
      apiKey: parsed.apiKey,
      payerEntity: parsed.payerEntity,
      baseUrl,
    })
  }

  private validateWebhookSignature(rawBody: Buffer, signature: string): void {
    const secret = this.config.get<string>('TIPALTI_WEBHOOK_SECRET')
    if (!secret) {
      this.logger.error('TIPALTI_WEBHOOK_SECRET is not configured')
      throw new UnauthorizedException('Webhook secret not configured')
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')

    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new UnauthorizedException('Invalid webhook signature')
    }
  }

  private mapProviderStatus(rawStatus: string): 'paid' | 'cancelled' | null {
    const normalized = rawStatus.toLowerCase()
    if (['paid', 'completed', 'approved'].includes(normalized)) return 'paid'
    if (['cancelled', 'canceled', 'rejected', 'declined'].includes(normalized)) return 'cancelled'
    return null
  }
}
