import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Invoice } from './invoice.entity'

@Entity('invoice_extras')
export class InvoiceExtra {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 500, comment: 'Extra description (e.g. Bonus, Reimbursement)' })
  description!: string

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: 'Extra amount (positive)' })
  amount!: number

  @Column({ type: 'int', comment: 'Display order' })
  sortOrder!: number

  @Column({ comment: 'Parent invoice ID' })
  invoiceId!: string

  @ManyToOne('Invoice', 'extraItems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
