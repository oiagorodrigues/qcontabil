import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly resend: Resend | null
  private readonly appUrl: string
  private readonly fromEmail: string

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')
    this.resend = apiKey ? new Resend(apiKey) : null
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173')
    this.fromEmail = this.config.get<string>('MAIL_FROM', 'noreply@qcontabil.com')
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${token}`
    const subject = 'Verifique seu email - Qcontabil'
    const html = `
      <h2>Bem-vindo ao Qcontabil!</h2>
      <p>Clique no link abaixo para verificar seu email:</p>
      <a href="${link}">${link}</a>
      <p>Este link expira em 24 horas.</p>
    `

    await this.send(to, subject, html, link)
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`
    const subject = 'Redefinir senha - Qcontabil'
    const html = `
      <h2>Redefinicao de senha</h2>
      <p>Clique no link abaixo para redefinir sua senha:</p>
      <a href="${link}">${link}</a>
      <p>Este link expira em 1 hora. Se voce nao solicitou, ignore este email.</p>
    `

    await this.send(to, subject, html, link)
  }

  private async send(to: string, subject: string, html: string, link: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[DEV EMAIL] To: ${to}`)
      this.logger.log(`[DEV EMAIL] Subject: ${subject}`)
      this.logger.log(`[DEV EMAIL] Link: ${link}`)
      return
    }

    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject,
      html,
    })
  }
}
