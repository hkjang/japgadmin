import { Module } from '@nestjs/common';
import { ReplicationController } from './replication.controller';
import { ReplicationService } from './replication.service';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [CoreModule, DatabaseModule],
  controllers: [ReplicationController],
  providers: [ReplicationService],
  exports: [ReplicationService],
})
export class ReplicationModule {}
