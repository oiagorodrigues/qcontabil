import { useForm } from '@tanstack/react-form'
import { createCompanySchema, TaxRegime, AccountType, BrazilianState } from '@qcontabil/shared'
import type { CreateCompanyInput, CompanyResponse } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/utils'

interface CompanyFormProps {
  initialData?: CompanyResponse
  onSubmit: (data: CreateCompanyInput) => void
  isSubmitting: boolean
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function stripMask(value: string): string {
  return value.replace(/\D/g, '')
}

const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  [TaxRegime.MEI]: 'MEI',
  [TaxRegime.EI]: 'EI',
  [TaxRegime.ME]: 'ME',
  [TaxRegime.SLU]: 'SLU',
  [TaxRegime.LTDA]: 'LTDA',
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.CORRENTE]: 'Corrente',
  [AccountType.POUPANCA]: 'Poupanca',
  [AccountType.COMPANY]: 'Company Account',
}

function FieldError({ errors }: { errors: unknown[] }) {
  if (errors.length === 0) return null
  return <p className="text-sm text-destructive">{getErrorMessage(errors[0])}</p>
}

export function CompanyForm({ initialData, onSubmit, isSubmitting }: CompanyFormProps) {
  const form = useForm({
    defaultValues: {
      legalName: initialData?.legalName || '',
      cnpj: initialData?.cnpj || '',
      taxRegime: initialData?.taxRegime || ('' as TaxRegime),
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      street: initialData?.street || '',
      streetNumber: initialData?.streetNumber || '',
      complement: initialData?.complement || '',
      zipCode: initialData?.zipCode || '',
      city: initialData?.city || '',
      state: initialData?.state || ('' as BrazilianState),
      country: initialData?.country || 'Brazil',
      bankBeneficiaryName: initialData?.bankBeneficiaryName || '',
      bankName: initialData?.bankName || '',
      bankAccountType: initialData?.bankAccountType || ('' as AccountType),
      bankAccountNumber: initialData?.bankAccountNumber || '',
      bankSwiftCode: initialData?.bankSwiftCode || '',
    } as CreateCompanyInput,
    validators: {
      onSubmit: createCompanySchema,
    },
    onSubmit: ({ value }) => {
      const cleaned = {
        ...value,
        complement: value.complement || undefined,
        bankBeneficiaryName: value.bankBeneficiaryName || undefined,
        bankName: value.bankName || undefined,
        bankAccountType: value.bankAccountType || undefined,
        bankAccountNumber: value.bankAccountNumber || undefined,
        bankSwiftCode: value.bankSwiftCode || undefined,
      }
      onSubmit(cleaned)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-8"
    >
      {/* Dados Gerais */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Dados da Empresa</h3>

        <form.Field name="legalName">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="legalName">Razao Social</Label>
              <Input
                id="legalName"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ex: Empresa Tecnologia LTDA"
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="cnpj">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formatCnpj(field.state.value)}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(stripMask(e.target.value))}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  maxLength={18}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="taxRegime">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="taxRegime">Regime Tributario</Label>
                <select
                  id="taxRegime"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value as TaxRegime)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Selecione</option>
                  {Object.entries(TAX_REGIME_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="contato@empresa.com"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="phone">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="11999999999"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>
      </section>

      {/* Endereco */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Endereco</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <form.Field name="street">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="street">Logradouro</Label>
                  <Input
                    id="street"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Rua, Av, Alameda..."
                  />
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="streetNumber">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="streetNumber">Numero</Label>
                <Input
                  id="streetNumber"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="complement">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input
                id="complement"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Andar, sala, bloco..."
              />
            </div>
          )}
        </form.Field>

        <div className="grid grid-cols-3 gap-4">
          <form.Field name="zipCode">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  value={formatCep(field.state.value)}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(stripMask(e.target.value))}
                  placeholder="XXXXX-XXX"
                  maxLength={9}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="city">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="state">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <select
                  id="state"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value as BrazilianState)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">UF</option>
                  {Object.values(BrazilianState).map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="country">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="country">Pais</Label>
              <Input
                id="country"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
      </section>

      {/* Dados Bancarios */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Dados Bancarios</h3>
        <p className="text-sm text-muted-foreground">
          Informacoes que aparecerao na secao de pagamento dos seus invoices.
        </p>

        <form.Field name="bankBeneficiaryName">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="bankBeneficiaryName">Nome do Beneficiario</Label>
              <Input
                id="bankBeneficiaryName"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Nome/razao social na conta"
              />
            </div>
          )}
        </form.Field>

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="bankName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="bankName">Nome do Banco</Label>
                <Input
                  id="bankName"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Ex: BANCO OURINVEST S.A"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="bankAccountType">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="bankAccountType">Tipo da Conta</Label>
                <select
                  id="bankAccountType"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value as AccountType)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Selecione</option>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="bankAccountNumber">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">Numero da Conta (IBAN)</Label>
                <Input
                  id="bankAccountNumber"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="BR82786327670000100113..."
                />
              </div>
            )}
          </form.Field>

          <form.Field name="bankSwiftCode">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="bankSwiftCode">Codigo SWIFT/BIC</Label>
                <Input
                  id="bankSwiftCode"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                  placeholder="OURIBRSPXXX"
                  maxLength={11}
                />
              </div>
            )}
          </form.Field>
        </div>
      </section>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando...' : initialData ? 'Salvar Alteracoes' : 'Cadastrar Empresa'}
      </Button>
    </form>
  )
}
