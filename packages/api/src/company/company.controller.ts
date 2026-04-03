import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { createCompanySchema, updateCompanySchema, paymentProviderConfigSchema } from '@qcontabil/shared'
import type { CreateCompanyInput, UpdateCompanyInput, PaymentProviderConfigInput } from '@qcontabil/shared'
import { CompanyService } from './company.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import type { User } from '../auth/entities/user.entity'

@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createCompanySchema)) dto: CreateCompanyInput,
  ) {
    return this.companyService.create(user.id, dto)
  }

  @Get('me')
  async getMyCompany(@CurrentUser() user: User) {
    const company = await this.companyService.findByUser(user.id)
    if (!company) {
      throw new NotFoundException('Empresa nao encontrada')
    }
    return company
  }

  @Put('me')
  async update(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateCompanySchema)) dto: UpdateCompanyInput,
  ) {
    return this.companyService.update(user.id, dto)
  }

  @Put('me/payment-config')
  async updatePaymentConfig(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(paymentProviderConfigSchema)) dto: PaymentProviderConfigInput,
  ) {
    return this.companyService.updatePaymentConfig(user.id, dto)
  }
}
