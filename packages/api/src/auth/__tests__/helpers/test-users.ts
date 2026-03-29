import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { DataSource } from 'typeorm'

const TEST_PASSWORD = 'StrongP@ss1234!'

export async function registerUser(
  app: INestApplication,
  email = 'test@example.com',
  password = TEST_PASSWORD,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password })
}

export async function verifyUserEmail(app: INestApplication, email: string) {
  const ds = app.get(DataSource)
  await ds.query('UPDATE "user" SET "emailVerified" = true WHERE email = $1', [email])
}

export async function createVerifiedUser(
  app: INestApplication,
  email = 'test@example.com',
  password = TEST_PASSWORD,
) {
  await registerUser(app, email, password)
  await verifyUserEmail(app, email)
  return { email, password }
}

export async function loginAndGetCookies(
  app: INestApplication,
  email = 'test@example.com',
  password = TEST_PASSWORD,
): Promise<{ cookies: string[]; response: request.Response }> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })

  const cookies = response.headers['set-cookie'] as unknown as string[]
  return { cookies, response }
}

export async function truncateAllTables(app: INestApplication) {
  const ds = app.get(DataSource)
  await ds.query('TRUNCATE TABLE email_token, refresh_token, "user" CASCADE')
}

export { TEST_PASSWORD }
