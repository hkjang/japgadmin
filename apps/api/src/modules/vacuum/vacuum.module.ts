import { Module } from '@nestjs/common';
import { VacuumController } from './vacuum.controller';
import { VacuumService } from './vacuum.service';
import { PostgresService } from '../../database/postgres.service';

@Module({
  controllers: [VacuumController],
  providers: [VacuumService, PostgresService],
  exports: [VacuumService],
})
export class VacuumModule {}
