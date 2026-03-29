import 'reflect-metadata'
import { DataSource } from 'typeorm'

export async function setup() {
  const dbUrl =
    process.env.DATABASE_URL || 'postgresql://qcontabil:qcontabil@localhost:5434/qcontabil_test'

  // Dynamically import entities to ensure decorator metadata is available
  const { User } = await import('../../src/auth/entities/user.entity')
  const { RefreshToken } = await import('../../src/auth/entities/refresh-token.entity')
  const { EmailToken } = await import('../../src/auth/entities/email-token.entity')
  const { Company } = await import('../../src/company/company.entity')

  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: [User, RefreshToken, EmailToken, Company],
    synchronize: true,
  })

  await ds.initialize()
  // Schema is now created — workers can connect with synchronize: false
  await ds.destroy()
}
