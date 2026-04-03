export interface SubmitInvoiceInput {
  invoiceNumber: string;
  amount: number;
  currency: string;
  description: string;
  issueDate: string;
  dueDate: string;
  payeeId: string;
  pdfBuffer: Buffer;
}

export interface SubmitInvoiceResult {
  providerRef: string;
  status: string;
}

export interface InvoiceStatusResult {
  status: string;
  raw: Record<string, unknown>;
}

export interface ConnectionValidationResult {
  valid: boolean;
  message?: string;
}

export interface PaymentProvider {
  submitInvoice(input: SubmitInvoiceInput): Promise<SubmitInvoiceResult>;
  getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult>;
  cancelInvoice(providerRef: string): Promise<void>;
  validateConnection(): Promise<ConnectionValidationResult>;
}
