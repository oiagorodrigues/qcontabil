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
  id!: string

  @Column()
  tokenHash!: string

  @Column({ type: "enum", enum: ["verification", "password_reset"] })
  type!: "verification" | "password_reset"

  @Column({ default: false })
  used!: boolean

  @Column({ type: "timestamp" })
  expiresAt!: Date

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User

  @Column()
  userId!: string
}
