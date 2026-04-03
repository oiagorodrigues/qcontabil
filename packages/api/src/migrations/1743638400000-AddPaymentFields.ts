import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaymentFields1743638400000 implements MigrationInterface {
  name = 'AddPaymentFields1743638400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invoice: payment provider tracking fields
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD "paymentProviderRef" character varying(255)`,
    )
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD "paymentProviderStatus" character varying(50)`,
    )

    // Company: payment provider configuration
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "payment_provider" character varying(20)`,
    )
    await queryRunner.query(`ALTER TABLE "companies" ADD "payment_provider_config" text`)

    // Client: payment configuration
    await queryRunner.query(
      `ALTER TABLE "clients" ADD "payment_provider_payee_id" character varying(255)`,
    )
    await queryRunner.query(`ALTER TABLE "clients" ADD "auto_send_day" smallint`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "auto_send_day"`)
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "payment_provider_payee_id"`)
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "payment_provider_config"`)
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "payment_provider"`)
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "paymentProviderStatus"`)
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "paymentProviderRef"`)
  }
}
