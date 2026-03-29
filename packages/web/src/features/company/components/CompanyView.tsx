import type { CompanyResponse } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CompanyViewProps {
  company: CompanyResponse
  onEdit: () => void
}

function formatCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

function formatCep(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || '-'}</span>
    </div>
  )
}

export function CompanyView({ company, onEdit }: CompanyViewProps) {
  const fullAddress = [
    `${company.street}, ${company.streetNumber}`,
    company.complement,
    `${formatCep(company.zipCode)} - ${company.city}/${company.state}`,
    company.country,
  ]
    .filter(Boolean)
    .join(', ')

  const hasBankData =
    company.bankBeneficiaryName ||
    company.bankName ||
    company.bankAccountNumber ||
    company.bankSwiftCode

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dados da Empresa</CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoRow label="Razao Social" value={company.legalName} />
          <InfoRow label="CNPJ" value={formatCnpj(company.cnpj)} />
          <InfoRow label="Regime Tributario" value={company.taxRegime} />
          <InfoRow label="Email" value={company.email} />
          <InfoRow label="Telefone" value={company.phone} />
          <div className="col-span-2">
            <InfoRow label="Endereco" value={fullAddress} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados Bancarios</CardTitle>
        </CardHeader>
        <CardContent>
          {hasBankData ? (
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Beneficiario" value={company.bankBeneficiaryName} />
              <InfoRow label="Banco" value={company.bankName} />
              <InfoRow label="Tipo da Conta" value={company.bankAccountType} />
              <InfoRow label="Numero da Conta (IBAN)" value={company.bankAccountNumber} />
              <InfoRow label="SWIFT/BIC" value={company.bankSwiftCode} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum dado bancario cadastrado. Clique em Editar para adicionar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
