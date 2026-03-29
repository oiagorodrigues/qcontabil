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

  @Column({ unique: true, comment: 'User email address, used as login identifier' })
  email!: string

  @Column({ comment: 'Argon2 hash of the user password' })
  passwordHash!: string

  @Column({ default: false, comment: 'Whether the user has confirmed their email via token link' })
  emailVerified!: boolean

  @Column({
    type: 'int',
    default: 0,
    comment: 'Consecutive failed login attempts; resets on success',
  })
  failedLoginAttempts!: number

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Account locked until this timestamp after too many failed attempts',
  })
  lockedUntil!: Date | null

  @CreateDateColumn({ comment: 'Timestamp of account creation' })
  createdAt!: Date

  @UpdateDateColumn({ comment: 'Timestamp of last account update' })
  updatedAt!: Date

  @OneToMany('RefreshToken', 'user')
  refreshTokens!: RefreshToken[]
}
