import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [CoreModule, DatabaseModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
