import { Module } from '@nestjs/common';
import { FailoverController } from './failover.controller';
import { FailoverService } from './failover.service';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';
import { ReplicationModule } from '../replication/replication.module';

@Module({
  imports: [CoreModule, DatabaseModule, ReplicationModule],
  controllers: [FailoverController],
  providers: [FailoverService],
  exports: [FailoverService],
})
export class FailoverModule {}
