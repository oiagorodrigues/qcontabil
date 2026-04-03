import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { createHmac } from 'node:crypto'
import { resolve } from 'path'
import cookieParser from 'cookie-parser'
import { User } from '../../src/auth/entities/user.entity'
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity'
import { EmailToken } from '../../src/auth/entities/email-token.entity'
import { AuthService } from '../../src/auth/auth.service'
import { TokenService } from '../../src/auth/token.service'
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy'
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard'
import { AuthController } from '../../src/auth/auth.controller'
import { MailModule } from '../../src/mail/mail.module'
import { HealthModule } from '../../src/health/health.module'
import { CompanyModule } from '../../src/company/company.module'
import { ClientsModule } from '../../src/clients/clients.module'
import { Invoice } from '../../src/invoices/entities/invoice.entity'
import { Company } from '../../src/company/company.entity'
import { Client } from '../../src/clients/entities/client.entity'
import { InvoicesModule } from '../../src/invoices/invoices.module'
import { PaymentsService } from '../../src/payments/payments.service'
import { PaymentsController } from '../../src/payments/payments.controller'
import { WebhookController } from '../../src/payments/webhook.controller'
import { PaymentsCronService } from '../../src/payments/payments-cron.service'
import { PaymentProviderFactory } from '../../src/payments/providers/payment-provider.factory'
import { TipaltiProvider } from '../../src/payments/providers/tipalti.provider'
import { ScheduleModule } from '@nestjs/schedule'
import { createVerifiedUser, loginAndGetCookies, uniqueEmail } from '../helpers/test-users'
import { createCompany, validCompanyData } from '../helpers/test-companies'

const WEBHOOK_SECRET = 'test-webhook-secret'
const ENCRYPTION_KEY = Buffer.alloc(32, 'a').toString('base64')

// Mock Tipalti API calls so integration tests don't need network access
vi.spyOn(TipaltiProvider.prototype, 'submitInvoice' as keyof TipaltiProvider).mockResolvedValue({
  providerRef: 'mock-tipalti-ref',
  status: 'pending',
})
vi.spyOn(TipaltiProvider.prototype, 'validateConnection' as keyof TipaltiProvider).mockResolvedValue({
  valid: true,
  message: 'Connection OK',
})

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, EmailToken]), PassportModule, JwtModule.registerAsync({
    useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET'), signOptions: { algorithm: 'HS256' as const } }),
    inject: [ConfigService],
  }), MailModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService],
})
class TestAuthModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [resolve(process.cwd(), '../../.env'), '.env'] }),
    TypeOrmModule.forRootAsync({ useFactory: (c: ConfigService) => ({ type: 'postgres' as const, url: c.get<string>('DATABASE_URL'), autoLoadEntities: true, synchronize: false }), inject: [ConfigService] }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
    HealthModule, TestAuthModule, CompanyModule, ClientsModule, InvoicesModule,
    TypeOrmModule.forFeature([Invoice, Company, Client]),
    ScheduleModule.forRoot(),
  ],
  controllers: [PaymentsController, WebhookController],
  providers: [
    PaymentsService,
    PaymentsCronService,
    {
      provide: PaymentProviderFactory,
      useFactory: () => {
        const factory = new PaymentProviderFactory()
        factory.register('tipalti', TipaltiProvider)
        return factory
      },
    },
  ],
})
class TestPaymentsAppModule {}

async function createPaymentsTestApp(): Promise<INestApplication> {
  process.env['TIPALTI_WEBHOOK_SECRET'] = WEBHOOK_SECRET
  process.env['PAYMENT_ENCRYPTION_KEY'] = ENCRYPTION_KEY

  const moduleRef = await Test.createTestingModule({ imports: [TestPaymentsAppModule] }).compile()
  const app = moduleRef.createNestApplication({ rawBody: true })
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()
  return app
}

function makeWebhookSignature(body: string) {
  return createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(body)).digest('hex')
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/payments/send/:id (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createPaymentsTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects unauthenticated request — 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/payments/send/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 when invoice does not exist — 404', async () => {
    const email = uniqueEmail('pay-send')
    await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, email)

    const res = await request(app.getHttpServer())
      .post('/api/payments/send/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookies)

    expect(res.status).toBe(404)
  })
})

describe('POST /api/payments/test-connection (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createPaymentsTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects unauthenticated request — 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/payments/test-connection')
    expect(res.status).toBe(401)
  })

  it('returns 400 when no payment provider is configured — 400', async () => {
    const email = uniqueEmail('pay-test-conn')
    await createVerifiedUser(app, email)
    const { cookies } = await loginAndGetCookies(app, email)
    await createCompany(app, cookies)

    const res = await request(app.getHttpServer())
      .post('/api/payments/test-connection')
      .set('Cookie', cookies)

    expect(res.status).toBe(400)
  })
})

describe('POST /api/webhooks/tipalti (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createPaymentsTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 without authentication for valid signature', async () => {
    const body = JSON.stringify({ invoiceRef: 'unknown-ref', status: 'paid' })
    const sig = makeWebhookSignature(body)

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/tipalti')
      .set('Content-Type', 'application/json')
      .set('x-tipalti-signature', sig)
      .send(body)

    expect(res.status).toBe(200)
  })

  it('returns 401 for invalid signature', async () => {
    const body = JSON.stringify({ invoiceRef: 'ref', status: 'paid' })

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/tipalti')
      .set('Content-Type', 'application/json')
      .set('x-tipalti-signature', 'bad-signature')
      .send(body)

    expect(res.status).toBe(401)
  })
})
