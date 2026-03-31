import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'
import type { User } from '../../auth/entities/user.entity'
import type { Contact } from './contact.entity'

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 200, comment: 'Trade name / fantasy name of the client company' })
  fantasyName!: string

  @Column({ length: 200, comment: 'Legal / registered company name' })
  company!: string

  @Column({ length: 100, comment: 'Country name (free text)' })
  country!: string

  @Column({ length: 2, comment: 'ISO 3166-1 alpha-2 country code' })
  countryCode!: string

  @Column({ length: 255, comment: 'Primary email of the client company' })
  email!: string

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Company phone number' })
  phone!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Company website URL' })
  website!: string | null

  @Column({ type: 'text', nullable: true, comment: 'Full address (free text)' })
  address!: string | null

  @Column({ type: 'text', nullable: true, comment: 'Free-form notes about the client' })
  notes!: string | null

  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'GBP', 'BRL', 'CAD', 'AUD', 'JPY', 'CHF'],
    comment: 'Preferred billing currency',
  })
  currency!: string

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'churned'],
    default: 'active',
    comment: 'Client relationship status',
  })
  status!: string

  @Column({ comment: 'Owner user ID' })
  userId!: string

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @OneToMany('Contact', 'client', { cascade: true })
  contacts!: Contact[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
