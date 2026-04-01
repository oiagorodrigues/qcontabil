import { Injectable } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import type { InvoiceDetail } from '@qcontabil/shared'
import type { CompanyResponse } from '@qcontabil/shared'

@Injectable()
export class PdfService {
  async generate(invoice: InvoiceDetail, company: CompanyResponse | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const pass = new PassThrough()
      const chunks: Buffer[] = []

      pass.on('data', (chunk: Buffer) => chunks.push(chunk))
      pass.on('end', () => resolve(Buffer.concat(chunks)))
      pass.on('error', reject)

      doc.pipe(pass)
      this.renderPdf(doc, invoice, company)
      doc.end()
    })
  }

  private renderPdf(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceDetail,
    company: CompanyResponse | null,
  ): void {
    const fmt = (amount: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(
        amount,
      )

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'right' })
    doc.fontSize(10).font('Helvetica')
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' })
    doc.text(`Issue Date: ${invoice.issueDate}`, { align: 'right' })
    doc.text(`Due Date: ${invoice.dueDate}`, { align: 'right' })
    doc.text(`Status: ${invoice.status.toUpperCase()}`, { align: 'right' })

    doc.moveDown(2)

    // From / To
    const fromX = 50
    const toX = 300
    const fromToY = doc.y

    doc.font('Helvetica-Bold').text('FROM:', fromX, fromToY)
    doc.font('Helvetica')
    if (company) {
      doc.text(company.legalName, fromX)
      if (company.street) {
        const addr = [company.street, company.streetNumber, company.city, company.state]
          .filter(Boolean)
          .join(', ')
        doc.text(addr, fromX)
      }
      if (company.email) doc.text(company.email, fromX)
    }

    doc.font('Helvetica-Bold').text('TO:', toX, fromToY)
    doc.font('Helvetica')
    doc.text(invoice.client.fantasyName, toX)
    doc.text(invoice.client.company, toX)
    doc.text(invoice.client.email, toX)
    if (invoice.client.address) doc.text(invoice.client.address, toX)
    doc.text(invoice.client.country, toX)

    doc.moveDown(2)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)

    // Services table
    doc.font('Helvetica-Bold').fontSize(11).text('SERVICES')
    doc.moveDown(0.5)

    const col = { desc: 50, qty: 310, rate: 390, amount: 470 }
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('Description', col.desc, doc.y, { width: 250 })
      .text('Qty', col.qty, doc.y - doc.currentLineHeight(), { width: 70, align: 'right' })
      .text('Rate', col.rate, doc.y - doc.currentLineHeight(), { width: 70, align: 'right' })
      .text('Amount', col.amount, doc.y - doc.currentLineHeight(), { width: 75, align: 'right' })

    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke()
    doc.strokeColor('black')
    doc.moveDown(0.3)

    doc.font('Helvetica').fontSize(9)
    for (const li of invoice.lineItems) {
      const rowY = doc.y
      doc.text(li.description, col.desc, rowY, { width: 250 })
      doc.text(String(li.quantity), col.qty, rowY, { width: 70, align: 'right' })
      doc.text(fmt(li.unitPrice), col.rate, rowY, { width: 70, align: 'right' })
      doc.text(fmt(li.amount), col.amount, rowY, { width: 75, align: 'right' })
      doc.moveDown(0.5)
    }

    doc.moveDown(0.5)
    doc
      .font('Helvetica-Bold')
      .text(`Subtotal: ${fmt(invoice.subtotal)}`, { align: 'right' })

    // Extras
    if (invoice.extraItems.length > 0) {
      doc.moveDown(1)
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(1)
      doc.font('Helvetica-Bold').fontSize(11).text('EXTRAS')
      doc.moveDown(0.5)

      const ecol = { desc: 50, amount: 470 }
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Description', ecol.desc, doc.y, { width: 410 })
        .text('Amount', ecol.amount, doc.y - doc.currentLineHeight(), { width: 75, align: 'right' })

      doc.moveDown(0.3)
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke()
      doc.strokeColor('black')
      doc.moveDown(0.3)

      doc.font('Helvetica').fontSize(9)
      for (const extra of invoice.extraItems) {
        const rowY = doc.y
        doc.text(extra.description, ecol.desc, rowY, { width: 410 })
        doc.text(fmt(extra.amount), ecol.amount, rowY, { width: 75, align: 'right' })
        doc.moveDown(0.5)
      }

      doc.moveDown(0.5)
      doc
        .font('Helvetica-Bold')
        .text(`Extras: ${fmt(invoice.extrasTotal)}`, { align: 'right' })
    }

    // Total
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)
    doc.font('Helvetica-Bold').fontSize(13).text(`TOTAL: ${fmt(invoice.total)}`, { align: 'right' })

    // Payment instructions
    if (invoice.paymentInstructions || this.hasBankInfo(company)) {
      doc.moveDown(1)
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(1)
      doc.font('Helvetica-Bold').fontSize(11).text('PAYMENT INSTRUCTIONS')
      doc.moveDown(0.5)
      doc.font('Helvetica').fontSize(9)

      if (invoice.paymentInstructions) {
        doc.text(invoice.paymentInstructions)
        doc.moveDown(0.5)
      }

      if (company && this.hasBankInfo(company)) {
        if (company.bankBeneficiaryName) doc.text(`Beneficiary: ${company.bankBeneficiaryName}`)
        if (company.bankName) doc.text(`Bank: ${company.bankName}`)
        if (company.bankAccountNumber) doc.text(`Account: ${company.bankAccountNumber}`)
        if (company.bankSwiftCode) doc.text(`SWIFT: ${company.bankSwiftCode}`)
      }
    }
  }

  private hasBankInfo(company: CompanyResponse | null): boolean {
    if (!company) return false
    return !!(
      company.bankBeneficiaryName ||
      company.bankName ||
      company.bankAccountNumber ||
      company.bankSwiftCode
    )
  }
}
