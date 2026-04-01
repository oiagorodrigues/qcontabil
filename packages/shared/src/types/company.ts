export enum TaxRegime {
  MEI = 'MEI',
  EI = 'EI',
  ME = 'ME',
  SLU = 'SLU',
  LTDA = 'LTDA',
}

export enum AccountType {
  CORRENTE = 'CORRENTE',
  POUPANCA = 'POUPANCA',
  COMPANY = 'COMPANY',
}

export enum BrazilianState {
  AC = 'AC',
  AL = 'AL',
  AP = 'AP',
  AM = 'AM',
  BA = 'BA',
  CE = 'CE',
  DF = 'DF',
  ES = 'ES',
  GO = 'GO',
  MA = 'MA',
  MT = 'MT',
  MS = 'MS',
  MG = 'MG',
  PA = 'PA',
  PB = 'PB',
  PR = 'PR',
  PE = 'PE',
  PI = 'PI',
  RJ = 'RJ',
  RN = 'RN',
  RS = 'RS',
  RO = 'RO',
  RR = 'RR',
  SC = 'SC',
  SP = 'SP',
  SE = 'SE',
  TO = 'TO',
}

export interface CompanyResponse {
  id: string
  legalName: string
  cnpj: string
  taxRegime: TaxRegime
  email: string
  phone: string
  street: string
  streetNumber: string
  complement: string | null
  zipCode: string
  city: string
  state: BrazilianState
  country: string
  bankBeneficiaryName: string | null
  bankName: string | null
  bankAccountType: AccountType | null
  bankAccountNumber: string | null
  bankSwiftCode: string | null
  invoicePrefix: string
  createdAt: string
  updatedAt: string
}
