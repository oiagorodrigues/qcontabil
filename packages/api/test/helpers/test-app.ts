import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { resolve } from 'path'
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

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, EmailToken]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' as const },
      }),
      inject: [ConfigService],
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // No ThrottlerGuard — rate limiting tested separately
  ],
  exports: [AuthService],
})
class TestAuthModule {}

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
    TestAuthModule,
    CompanyModule,
    ClientsModule,
  ],
})
class TestAppModule {}

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [TestAppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()

  return app
}
