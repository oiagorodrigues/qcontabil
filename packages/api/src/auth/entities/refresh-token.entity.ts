import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm'
import { User } from './user.entity'

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ comment: 'SHA-256 hash of the refresh token value' })
  tokenHash!: string

  @Column({ comment: 'Token rotation family ID; all tokens in a chain share this value' })
  family!: string

  @Column({ default: false, comment: 'Whether this token has been revoked (rotation or logout)' })
  revoked!: boolean

  @Column({ type: 'timestamp', comment: 'Token expiration timestamp' })
  expiresAt!: Date

  @CreateDateColumn({ comment: 'Timestamp of token creation' })
  createdAt!: Date

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  user!: User

  @Column({ comment: 'FK to the owning user' })
  userId!: string
}
