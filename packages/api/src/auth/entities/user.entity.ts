import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import type { RefreshToken } from './refresh-token.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  @Column()
  passwordHash!: string

  @Column({ default: false })
  emailVerified!: boolean

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil!: Date | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany('RefreshToken', 'user')
  refreshTokens!: RefreshToken[]
}
