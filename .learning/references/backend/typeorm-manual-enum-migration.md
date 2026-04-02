# TypeORM: Migration Manual para Enum Column

## Contexto

O projeto qcontabil usa `synchronize: true` em desenvolvimento e não tem CLI TypeORM configurado (sem `data-source.ts` dedicado). Para adicionar uma coluna enum em produção-safe, foi necessário escrever a migration manualmente.

## Problema

`typeorm migration:generate` requer um `DataSource` exportado. Sem isso:

```
Error: Unable to open file: "data-source.ts"
```

## Solução: Migration handcrafted

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddInvoiceTemplateFields1743552000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Criar o tipo enum no PostgreSQL
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invoice_template_enum" AS ENUM ('classic', 'modern', 'minimal');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    // 2. Adicionar coluna na tabela invoices com default
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "template" "invoice_template_enum"
        NOT NULL DEFAULT 'classic'
    `)

    // 3. Adicionar coluna nullable em outra tabela
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "default_template" "invoice_template_enum"
        DEFAULT 'classic'
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "default_template"`)
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "template"`)
    await queryRunner.query(`DROP TYPE IF EXISTS "invoice_template_enum"`)
  }
}
```

## Pontos críticos

- **`DO $$ BEGIN ... EXCEPTION WHEN duplicate_object`**: idempotente — não falha se o tipo já existe (útil se `synchronize: true` já criou o enum)
- **`IF NOT EXISTS`**: torna `up()` idempotente para as colunas também
- **Naming**: TypeORM gera `invoice_template_enum` para enum no campo `template` da entidade `Invoice` — usar o mesmo nome na migration para compatibilidade

## Para configurar CLI no futuro

Criar `packages/api/src/data-source.ts`:

```typescript
import { DataSource } from 'typeorm'
import { config } from './config'

export const AppDataSource = new DataSource({ ...config, migrations: ['src/migrations/*.ts'] })
```

E em `package.json`:

```json
"migration:generate": "typeorm migration:generate -d src/data-source.ts"
```
