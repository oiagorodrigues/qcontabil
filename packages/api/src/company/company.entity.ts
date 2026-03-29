import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { TaxRegime, AccountType, BrazilianState } from '@qcontabil/shared'
import { User } from '../auth/entities/user.entity'

@Entity('companies')
@Unique(['cnpj'])
@Unique(['userId'])
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid', comment: 'Owner user FK — 1:1 relationship' })
  userId!: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({
    name: 'legal_name',
    type: 'varchar',
    length: 200,
    comment: 'Razao social da empresa',
  })
  legalName!: string

  @Column({ type: 'varchar', length: 14, comment: 'CNPJ sem mascara (14 digitos)' })
  cnpj!: string

  @Column({
    name: 'tax_regime',
    type: 'enum',
    enum: TaxRegime,
    comment: 'Regime tributario: MEI, EI, ME, SLU, LTDA',
  })
  taxRegime!: TaxRegime

  @Column({ type: 'varchar', comment: 'Email de contato da empresa' })
  email!: string

  @Column({ type: 'varchar', length: 20, comment: 'Telefone com DDD' })
  phone!: string

  @Column({ type: 'varchar', length: 200, comment: 'Logradouro' })
  street!: string

  @Column({
    name: 'street_number',
    type: 'varchar',
    length: 20,
    comment: 'Numero do endereco',
  })
  streetNumber!: string

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Complemento (andar, sala, etc)',
  })
  complement!: string | null

  @Column({ name: 'zip_code', type: 'varchar', length: 8, comment: 'CEP sem mascara (8 digitos)' })
  zipCode!: string

  @Column({ type: 'varchar', length: 100, comment: 'Cidade' })
  city!: string

  @Column({ type: 'enum', enum: BrazilianState, comment: 'UF do estado' })
  state!: BrazilianState

  @Column({
    type: 'varchar',
    length: 100,
    default: 'Brazil',
    comment: 'Pais (default Brazil)',
  })
  country!: string

  @Column({
    name: 'bank_beneficiary_name',
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: 'Nome do titular da conta bancaria',
  })
  bankBeneficiaryName!: string | null

  @Column({
    name: 'bank_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Nome do banco',
  })
  bankName!: string | null

  @Column({
    name: 'bank_account_type',
    type: 'enum',
    enum: AccountType,
    nullable: true,
    comment: 'Tipo da conta: corrente, poupanca, company',
  })
  bankAccountType!: AccountType | null

  @Column({
    name: 'bank_account_number',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Numero da conta (formato IBAN)',
  })
  bankAccountNumber!: string | null

  @Column({
    name: 'bank_swift_code',
    type: 'varchar',
    length: 11,
    nullable: true,
    comment: 'Codigo SWIFT/BIC do banco',
  })
  bankSwiftCode!: string | null

  @CreateDateColumn({ name: 'created_at', comment: 'Data de criacao do registro' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', comment: 'Data da ultima atualizacao' })
  updatedAt!: Date
}
