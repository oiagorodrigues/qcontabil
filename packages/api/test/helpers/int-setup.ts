import 'reflect-metadata'

// Override DATABASE_URL to point at the test database (port 5434)
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://qcontabil:qcontabil@localhost:5434/qcontabil_test'
