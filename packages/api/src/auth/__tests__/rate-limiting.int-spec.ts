import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { resolve } from 'path'
import { AuthModule } from '../auth.module'
import { HealthModule } from '../../health/health.module'
import { uniqueEmail } from './helpers/test-users'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '../../.env'), '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
    HealthModule,
    AuthModule, // Full AuthModule with ThrottlerGuard
  ],
})
class ThrottledTestAppModule {}

describe('Rate limiting (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottledTestAppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('throttles login after 5 attempts', async () => {
    const server = app.getHttpServer()

    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/api/auth/login')
        .send({ email: uniqueEmail('throttle-login'), password: 'pass12345678' })
    }

    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('throttle-login'), password: 'pass12345678' })

    expect(res.status).toBe(429)
  })

  it('throttles register after 5 attempts', async () => {
    const server = app.getHttpServer()

    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/api/auth/register')
        .send({ email: uniqueEmail('throttle-reg'), password: 'StrongP@ss1234!' })
    }

    const res = await request(server)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('throttle-reg'), password: 'StrongP@ss1234!' })

    expect(res.status).toBe(429)
  })

  it('throttles forgot-password after 3 attempts', async () => {
    const server = app.getHttpServer()

    for (let i = 0; i < 3; i++) {
      await request(server)
        .post('/api/auth/forgot-password')
        .send({ email: uniqueEmail('throttle-forgot') })
    }

    const res = await request(server)
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('throttle-forgot') })

    expect(res.status).toBe(429)
  })
})
