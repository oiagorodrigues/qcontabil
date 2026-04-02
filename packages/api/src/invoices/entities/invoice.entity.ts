import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm'
import type { User } from '../../auth/entities/user.entity'
import type { Client } from '../../clients/entities/client.entity'
import type { InvoiceLineItem } from './invoice-line-item.entity'
import type { InvoiceExtra } from './invoice-extra.entity'
import { InvoiceTemplate } from '../templates/template.types'

@Entity('invoices')
@Unique(['userId', 'invoiceNumber'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 20, comment: 'Sequential number: {PREFIX}-{0001}' })
  invoiceNumber!: string

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft',
    comment: 'Invoice lifecycle status',
  })
  status!: string

  @Column({ type: 'date', comment: 'Issue date' })
  issueDate!: string

  @Column({ type: 'date', comment: 'Due date (must be >= issueDate)' })
  dueDate!: string

  @Column({ type: 'timestamp', nullable: true, comment: 'When status changed to sent' })
  sentAt!: Date | null

  @Column({ type: 'timestamp', nullable: true, comment: 'When status changed to paid' })
  paidAt!: Date | null

  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'GBP', 'BRL', 'CAD', 'AUD', 'JPY', 'CHF'],
    comment: 'Billing currency',
  })
  currency!: string

  @Column({ type: 'text', comment: 'General description of services rendered' })
  description!: string

  @Column({ type: 'text', nullable: true, comment: 'Internal notes (not shown on PDF)' })
  notes!: string | null

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Payment instructions shown on PDF',
  })
  paymentInstructions!: string | null

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: 'Sum of line item amounts',
  })
  subtotal!: number

  @Column({
    name: 'extras_total',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: 'Sum of extra amounts',
  })
  extrasTotal!: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: 'subtotal + extrasTotal',
  })
  total!: number

  @Column({ comment: 'Client FK' })
  clientId!: string

  @ManyToOne('Client', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clientId' })
  client!: Client

  @Column({ comment: 'Owner user ID' })
  userId!: string

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @OneToMany('InvoiceLineItem', 'invoice', { cascade: true })
  lineItems!: InvoiceLineItem[]

  @OneToMany('InvoiceExtra', 'invoice', { cascade: true })
  extraItems!: InvoiceExtra[]

  @Column({
    type: 'enum',
    enum: InvoiceTemplate,
    default: InvoiceTemplate.CLASSIC,
    comment: 'PDF template used to render this invoice',
  })
  template!: InvoiceTemplate

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
