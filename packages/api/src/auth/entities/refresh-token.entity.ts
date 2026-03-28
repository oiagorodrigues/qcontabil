import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from "typeorm"
import { User } from "./user.entity"

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  declare id: string

  @Column()
  declare tokenHash: string

  @Column()
  declare family: string

  @Column({ default: false })
  declare revoked: boolean

  @Column({ type: "timestamp" })
  declare expiresAt: Date

  @CreateDateColumn()
  declare createdAt: Date

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: "CASCADE" })
  declare user: User

  @Column()
  declare userId: string
}
