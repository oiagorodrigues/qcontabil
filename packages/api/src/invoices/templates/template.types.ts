import type { InvoiceDetail } from '@qcontabil/shared'
import type { CompanyResponse } from '@qcontabil/shared'

/** Available invoice PDF templates. */
export enum InvoiceTemplate {
  CLASSIC = 'classic',
  MODERN = 'modern',
  MINIMAL = 'minimal',
}

/** PDFKit document instance type. */
export type PdfDoc = PDFKit.PDFDocument

/** Renders invoice content into a PDFKit document. */
export type TemplateFunction = (
  doc: PdfDoc,
  invoice: InvoiceDetail,
  company: CompanyResponse | null,
) => void
