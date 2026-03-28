import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm'
import { User } from './user.entity'

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  tokenHash!: string

  @Column()
  family!: string

  @Column({ default: false })
  revoked!: boolean

  @Column({ type: 'timestamp' })
  expiresAt!: Date

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  user!: User

  @Column()
  userId!: string
}
