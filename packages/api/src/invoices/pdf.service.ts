import { Injectable } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import type { InvoiceDetail } from '@qcontabil/shared'
import type { CompanyResponse } from '@qcontabil/shared'
import { InvoiceTemplate } from './templates/template.types'
import { getTemplate } from './templates/template.registry'

@Injectable()
export class PdfService {
  async generate(invoice: InvoiceDetail, company: CompanyResponse | null): Promise<Buffer> {
    // invoice.template will be added in T3/T4; fall back to CLASSIC until then
    const templateName =
      (invoice as InvoiceDetail & { template?: InvoiceTemplate }).template ??
      InvoiceTemplate.CLASSIC

    const renderTemplate = getTemplate(templateName)

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const pass = new PassThrough()
      const chunks: Buffer[] = []

      pass.on('data', (chunk: Buffer) => chunks.push(chunk))
      pass.on('end', () => resolve(Buffer.concat(chunks)))
      pass.on('error', reject)

      doc.pipe(pass)
      renderTemplate(doc, invoice, company)
      doc.end()
    })
  }
}
