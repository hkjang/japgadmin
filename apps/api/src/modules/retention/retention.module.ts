import { Module } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { TaskModule } from '../task/task.module';

import { CoreModule } from '../core/core.module';

@Module({
  imports: [TaskModule, CoreModule],
  controllers: [RetentionController],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
