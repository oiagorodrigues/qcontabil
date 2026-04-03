import type { TemplateFunction } from './template.types'

const BRAND = '#1e3a5f'
const WHITE = '#ffffff'
const LIGHT_GRAY_BG = '#f4f4f4'
const TEXT_DARK = '#111111'
const PAGE_L = 50
const PAGE_R = 545

export const modernTemplate: TemplateFunction = (doc, invoice, company): void => {
  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(amount)

  // ─── Header band ────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 80).fill(BRAND)

  // Company name (white, bold) inside band
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(WHITE)
    .text(company?.legalName ?? 'Invoice', PAGE_L, 18, { width: 300 })

  // "INVOICE" label top-right inside band
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(WHITE)
    .text('INVOICE', PAGE_L, 18, { width: PAGE_R - PAGE_L, align: 'right' })

  // Invoice number below label inside band
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(WHITE)
    .text(`#${invoice.invoiceNumber}`, PAGE_L, 36, { width: PAGE_R - PAGE_L, align: 'right' })

  // Reset fill color and move below band
  doc.fillColor(TEXT_DARK)
  doc.y = 96

  // ─── Issue / due / status row ───────────────────────────────────────────────
  doc.font('Helvetica').fontSize(9).fillColor('#555555')
  doc.text(
    `Issue Date: ${invoice.issueDate}   Due Date: ${invoice.dueDate}   Status: ${invoice.status.toUpperCase()}`,
    PAGE_L,
    doc.y,
    { width: PAGE_R - PAGE_L, align: 'right' },
  )
  doc.fillColor(TEXT_DARK)
  doc.moveDown(1.5)

  // ─── From / To block ────────────────────────────────────────────────────────
  const fromToY = doc.y
  const toX = 310

  doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND).text('FROM', PAGE_L, fromToY)
  doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(10)
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

  doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND).text('TO', toX, fromToY)
  doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(10)
  doc.text(invoice.client.fantasyName, toX)
  doc.text(invoice.client.company, toX)
  doc.text(invoice.client.email, toX)
  if (invoice.client.address) doc.text(invoice.client.address, toX)
  doc.text(invoice.client.country, toX)

  doc.moveDown(2)

  // ─── Services table ──────────────────────────────────────────────────────────
  // Header band
  const tableHeaderY = doc.y
  doc.rect(PAGE_L, tableHeaderY, PAGE_R - PAGE_L, 18).fill(BRAND)

  const col = { desc: PAGE_L + 4, qty: 312, rate: 392, amount: 470 }
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(WHITE)
    .text('Description', col.desc, tableHeaderY + 4, { width: 252 })
    .text('Qty', col.qty, tableHeaderY + 4, { width: 70, align: 'right' })
    .text('Rate', col.rate, tableHeaderY + 4, { width: 70, align: 'right' })
    .text('Amount', col.amount, tableHeaderY + 4, { width: 71, align: 'right' })

  doc.y = tableHeaderY + 22
  doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9)

  for (const li of invoice.lineItems) {
    const rowY = doc.y
    doc.text(li.description, col.desc, rowY, { width: 252 })
    doc.text(String(li.quantity), col.qty, rowY, { width: 70, align: 'right' })
    doc.text(fmt(li.unitPrice), col.rate, rowY, { width: 70, align: 'right' })
    doc.text(fmt(li.amount), col.amount, rowY, { width: 71, align: 'right' })
    doc.moveDown(0.5)

    // subtle row separator
    doc.moveTo(PAGE_L, doc.y).lineTo(PAGE_R, doc.y).strokeColor('#e0e0e0').lineWidth(0.5).stroke()
    doc.strokeColor('black').lineWidth(1)
    doc.moveDown(0.3)
  }

  doc.moveDown(0.5)

  // ─── Subtotal ────────────────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(9).fillColor('#555555')
  doc.text(`Subtotal: ${fmt(invoice.subtotal)}`, PAGE_L, doc.y, {
    width: PAGE_R - PAGE_L,
    align: 'right',
  })
  doc.fillColor(TEXT_DARK)

  // ─── Extras table ────────────────────────────────────────────────────────────
  if (invoice.extraItems.length > 0) {
    doc.moveDown(1.5)
    const extrasHeaderY = doc.y
    doc.rect(PAGE_L, extrasHeaderY, PAGE_R - PAGE_L, 18).fill(BRAND)

    const ecol = { desc: col.desc, amount: col.amount }
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(WHITE)
      .text('Extras / Adjustments', ecol.desc, extrasHeaderY + 4, { width: 410 })
      .text('Amount', ecol.amount, extrasHeaderY + 4, { width: 71, align: 'right' })

    doc.y = extrasHeaderY + 22
    doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9)

    for (const extra of invoice.extraItems) {
      const rowY = doc.y
      doc.text(extra.description, ecol.desc, rowY, { width: 410 })
      doc.text(fmt(extra.amount), ecol.amount, rowY, { width: 71, align: 'right' })
      doc.moveDown(0.5)
      doc.moveTo(PAGE_L, doc.y).lineTo(PAGE_R, doc.y).strokeColor('#e0e0e0').lineWidth(0.5).stroke()
      doc.strokeColor('black').lineWidth(1)
      doc.moveDown(0.3)
    }

    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
    doc.text(`Extras: ${fmt(invoice.extrasTotal)}`, PAGE_L, doc.y, {
      width: PAGE_R - PAGE_L,
      align: 'right',
    })
    doc.fillColor(TEXT_DARK)
  }

  // ─── Total box ───────────────────────────────────────────────────────────────
  doc.moveDown(1.5)
  const totalBoxY = doc.y
  const totalBoxH = 28
  doc.rect(PAGE_L, totalBoxY, PAGE_R - PAGE_L, totalBoxH).fill(LIGHT_GRAY_BG)
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(BRAND)
    .text(`TOTAL: ${fmt(invoice.total)}`, PAGE_L, totalBoxY + 7, {
      width: PAGE_R - PAGE_L - 4,
      align: 'right',
    })
  doc.fillColor(TEXT_DARK)
  doc.y = totalBoxY + totalBoxH + 8

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
    doc.moveDown(1)
    doc.moveTo(PAGE_L, doc.y).lineTo(PAGE_R, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke()
    doc.strokeColor('black').lineWidth(1)
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text('PAYMENT INSTRUCTIONS')
    doc.fillColor(TEXT_DARK)
    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(9)

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
