import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Client } from './entities/client.entity'
import { Contact } from './entities/contact.entity'
import { ClientsService } from './clients.service'
import { ClientsController } from './clients.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Client, Contact])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
