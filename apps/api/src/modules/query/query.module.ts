import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { PostgresService } from '../../database/postgres.service';

@Module({
  controllers: [QueryController],
  providers: [QueryService, PostgresService],
  exports: [QueryService],
})
export class QueryModule {}
