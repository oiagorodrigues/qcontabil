import type { TemplateFunction } from './template.types'

const BLACK = '#000000'
const GRAY = '#666666'
const PAGE_L = 50
const PAGE_R = 545
const BASE_FONT = 11
const SMALL_FONT = 9

export const minimalTemplate: TemplateFunction = (doc, invoice, company): void => {
  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(amount)

  // ─── Header ──────────────────────────────────────────────────────────────────
  // Company name — left; "INVOICE" — right
  doc
    .font('Helvetica-Bold')
    .fontSize(BASE_FONT + 9)
    .fillColor(BLACK)
    .text(company?.legalName ?? '', PAGE_L, doc.y, { continued: false })

  doc
    .font('Helvetica-Bold')
    .fontSize(BASE_FONT + 9)
    .fillColor(BLACK)
    .text('INVOICE', PAGE_L, doc.y - doc.currentLineHeight(), {
      width: PAGE_R - PAGE_L,
      align: 'right',
    })

  doc.moveDown(0.5)

  // Meta row — dates and status in gray on the right
  doc
    .font('Helvetica')
    .fontSize(SMALL_FONT)
    .fillColor(GRAY)
    .text(
      `#${invoice.invoiceNumber}   ${invoice.issueDate} → ${invoice.dueDate}   ${invoice.status.toUpperCase()}`,
      PAGE_L,
      doc.y,
      { width: PAGE_R - PAGE_L, align: 'right' },
    )
  doc.fillColor(BLACK)

  doc.moveDown(2.5)

  // ─── From / To block ────────────────────────────────────────────────────────
  const fromToY = doc.y
  const toX = 310

  doc.font('Helvetica-Bold').fontSize(SMALL_FONT).fillColor(GRAY).text('From', PAGE_L, fromToY)
  doc.fillColor(BLACK).font('Helvetica').fontSize(BASE_FONT)
  if (company) {
    doc.text(company.legalName, PAGE_L)
    if (company.street) {
      const addr = [company.street, company.streetNumber, company.city, company.state]
        .filter(Boolean)
        .join(', ')
      doc.text(addr, PAGE_L)
    }
    if (company.email) doc.text(company.email, PAGE_L)
  }

  doc.font('Helvetica-Bold').fontSize(SMALL_FONT).fillColor(GRAY).text('To', toX, fromToY)
  doc.fillColor(BLACK).font('Helvetica').fontSize(BASE_FONT)
  doc.text(invoice.client.fantasyName, toX)
  doc.text(invoice.client.company, toX)
  doc.text(invoice.client.email, toX)
  if (invoice.client.address) doc.text(invoice.client.address, toX)
  doc.text(invoice.client.country, toX)

  doc.moveDown(2.5)

  // ─── Services ────────────────────────────────────────────────────────────────
  // Section label
  doc.font('Helvetica-Bold').fontSize(SMALL_FONT).fillColor(GRAY).text('Services')
  doc.fillColor(BLACK)
  doc.moveDown(0.8)

  // Column header row — no background, only subtle gray text
  const col = { desc: PAGE_L, qty: 312, rate: 392, amount: 470 }
  const headerY = doc.y
  doc
    .font('Helvetica-Bold')
    .fontSize(SMALL_FONT)
    .fillColor(GRAY)
    .text('Description', col.desc, headerY, { width: 252 })
    .text('Qty', col.qty, headerY, { width: 70, align: 'right' })
    .text('Rate', col.rate, headerY, { width: 70, align: 'right' })
    .text('Amount', col.amount, headerY, { width: 71, align: 'right' })

  doc.fillColor(BLACK)
  doc.moveDown(0.8)

  doc.font('Helvetica').fontSize(BASE_FONT)
  for (const li of invoice.lineItems) {
    const rowY = doc.y
    doc.text(li.description, col.desc, rowY, { width: 252 })
    doc.text(String(li.quantity), col.qty, rowY, { width: 70, align: 'right' })
    doc.text(fmt(li.unitPrice), col.rate, rowY, { width: 70, align: 'right' })
    doc.text(fmt(li.amount), col.amount, rowY, { width: 71, align: 'right' })
    doc.moveDown(0.7)
  }

  doc.moveDown(0.5)

  // Subtotal — right-aligned, no box
  doc.font('Helvetica').fontSize(SMALL_FONT).fillColor(GRAY)
  doc.text(`Subtotal   ${fmt(invoice.subtotal)}`, PAGE_L, doc.y, {
    width: PAGE_R - PAGE_L,
    align: 'right',
  })
  doc.fillColor(BLACK)

  // ─── Extras ──────────────────────────────────────────────────────────────────
  if (invoice.extraItems.length > 0) {
    doc.moveDown(2.5)

    doc.font('Helvetica-Bold').fontSize(SMALL_FONT).fillColor(GRAY).text('Extras / Adjustments')
    doc.fillColor(BLACK)
    doc.moveDown(0.8)

    const ecol = { desc: PAGE_L, amount: col.amount }
    const extrasHeaderY = doc.y
    doc
      .font('Helvetica-Bold')
      .fontSize(SMALL_FONT)
      .fillColor(GRAY)
      .text('Description', ecol.desc, extrasHeaderY, { width: 410 })
      .text('Amount', ecol.amount, extrasHeaderY, { width: 71, align: 'right' })

    doc.fillColor(BLACK)
    doc.moveDown(0.8)

    doc.font('Helvetica').fontSize(BASE_FONT)
    for (const extra of invoice.extraItems) {
      const rowY = doc.y
      doc.text(extra.description, ecol.desc, rowY, { width: 410 })
      doc.text(fmt(extra.amount), ecol.amount, rowY, { width: 71, align: 'right' })
      doc.moveDown(0.7)
    }

    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(SMALL_FONT).fillColor(GRAY)
    doc.text(`Extras   ${fmt(invoice.extrasTotal)}`, PAGE_L, doc.y, {
      width: PAGE_R - PAGE_L,
      align: 'right',
    })
    doc.fillColor(BLACK)
  }

  // ─── Total ───────────────────────────────────────────────────────────────────
  doc.moveDown(2)

  doc
    .font('Helvetica-Bold')
    .fontSize(BASE_FONT + 3)
    .fillColor(BLACK)
    .text(`Total   ${fmt(invoice.total)}`, PAGE_L, doc.y, {
      width: PAGE_R - PAGE_L,
      align: 'right',
    })

  // ─── Payment instructions ─────────────────────────────────────────────────
  const hasBankInfo =
    !!company &&
    !!(
      company.bankBeneficiaryName ||
      company.bankName ||
      company.bankAccountNumber ||
      company.bankSwiftCode
    )

  if (invoice.paymentInstructions || hasBankInfo) {
    doc.moveDown(2.5)

    doc.font('Helvetica-Bold').fontSize(SMALL_FONT).fillColor(GRAY).text('Payment Instructions')
    doc.fillColor(BLACK)
    doc.moveDown(0.8)
    doc.font('Helvetica').fontSize(BASE_FONT)

    if (invoice.paymentInstructions) {
      doc.text(invoice.paymentInstructions)
      doc.moveDown(0.5)
    }

    if (company && hasBankInfo) {
      if (company.bankBeneficiaryName) doc.text(`Beneficiary: ${company.bankBeneficiaryName}`)
      if (company.bankName) doc.text(`Bank: ${company.bankName}`)
      if (company.bankAccountNumber) doc.text(`Account: ${company.bankAccountNumber}`)
      if (company.bankSwiftCode) doc.text(`SWIFT: ${company.bankSwiftCode}`)
    }
  }
}
