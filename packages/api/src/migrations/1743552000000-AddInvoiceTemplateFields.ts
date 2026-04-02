import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddInvoiceTemplateFields1743552000000 implements MigrationInterface {
  name = 'AddInvoiceTemplateFields1743552000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_template_enum" AS ENUM('classic', 'modern', 'minimal')`,
    )
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD "template" "public"."invoice_template_enum" NOT NULL DEFAULT 'classic'`,
    )
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "default_template" "public"."invoice_template_enum" DEFAULT 'classic'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "default_template"`)
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "template"`)
    await queryRunner.query(`DROP TYPE "public"."invoice_template_enum"`)
  }
}
