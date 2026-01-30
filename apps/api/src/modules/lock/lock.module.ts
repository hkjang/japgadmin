import { Module } from '@nestjs/common';
import { LockController } from './lock.controller';
import { LockService } from './lock.service';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, CoreModule, AuthModule],
  controllers: [LockController],
  providers: [LockService],
  exports: [LockService],
})
export class LockModule {}
