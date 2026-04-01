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

@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 500, comment: 'Service description' })
  description!: string

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: 'Hours or units' })
  quantity!: number

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: 'Rate per unit' })
  unitPrice!: number

  get amount(): number {
    return Number(this.quantity) * Number(this.unitPrice)
  }

  @Column({ type: 'int', comment: 'Display order' })
  sortOrder!: number

  @Column({ comment: 'Parent invoice ID' })
  invoiceId!: string

  @ManyToOne('Invoice', 'lineItems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
