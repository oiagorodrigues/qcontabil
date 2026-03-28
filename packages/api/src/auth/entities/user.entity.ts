import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm"
import { RefreshToken } from "./refresh-token.entity"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  declare id: string

  @Column({ unique: true })
  declare email: string

  @Column()
  declare passwordHash: string

  @Column({ default: false })
  declare emailVerified: boolean

  @Column({ type: "int", default: 0 })
  declare failedLoginAttempts: number

  @Column({ type: "timestamp", nullable: true })
  declare lockedUntil: Date | null

  @CreateDateColumn()
  declare createdAt: Date

  @UpdateDateColumn()
  declare updatedAt: Date

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  declare refreshTokens: RefreshToken[]
}
