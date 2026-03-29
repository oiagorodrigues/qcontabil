import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm'
import { User } from './user.entity'

@Entity('email_tokens')
export class EmailToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ comment: 'SHA-256 hash of the email token value' })
  tokenHash!: string

  @Column({
    type: 'enum',
    enum: ['verification', 'password_reset'],
    comment: 'Token purpose: email verification or password reset',
  })
  type!: 'verification' | 'password_reset'

  @Column({ default: false, comment: 'Whether this token has already been consumed' })
  used!: boolean

  @Column({ type: 'timestamp', comment: 'Token expiration timestamp' })
  expiresAt!: Date

  @CreateDateColumn({ comment: 'Timestamp of token creation' })
  createdAt!: Date

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User

  @Column({ comment: 'FK to the owning user' })
  userId!: string
}
