import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type { Client } from './client.entity'

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 200, comment: 'Full name of the contact person' })
  name!: string

  @Column({ length: 255, comment: 'Contact email address' })
  email!: string

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Contact phone number' })
  phone!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Job title or role (e.g. CTO, Accounts Payable)' })
  role!: string | null

  @Column({ default: false, comment: 'Whether this is the primary contact for the client' })
  isPrimary!: boolean

  @Column({ comment: 'Parent client ID' })
  clientId!: string

  @ManyToOne('Client', 'contacts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client!: Client

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
