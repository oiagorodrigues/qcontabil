import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common'
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
} from '@qcontabil/shared'
import type { CreateClientInput, UpdateClientInput, ListClientsQuery } from '@qcontabil/shared'
import { ClientsService } from './clients.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import type { User } from '../auth/entities/user.entity'

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createClientSchema)) dto: CreateClientInput,
  ) {
    return this.clientsService.create(user.id, dto)
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(listClientsQuerySchema)) query: ListClientsQuery,
  ) {
    return this.clientsService.findAll(user.id, query)
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(user.id, id)
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) dto: UpdateClientInput,
  ) {
    return this.clientsService.update(user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.clientsService.remove(user.id, id)
  }
}
