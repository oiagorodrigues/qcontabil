import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from "typeorm"
import { User } from "./user.entity"

@Entity("email_tokens")
export class EmailToken {
  @PrimaryGeneratedColumn("uuid")
  declare id: string

  @Column()
  declare tokenHash: string

  @Column({ type: "enum", enum: ["verification", "password_reset"] })
  declare type: "verification" | "password_reset"

  @Column({ default: false })
  declare used: boolean

  @Column({ type: "timestamp" })
  declare expiresAt: Date

  @CreateDateColumn()
  declare createdAt: Date

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  declare user: User

  @Column()
  declare userId: string
}
